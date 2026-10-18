import { supabase } from "./cloud-client";
import { cacheGet, cacheSet, persist } from "./storage";
import {
  changesBetween,
  flatten,
  hydrate,
  type Document,
  type Change,
} from "./cloud-codec";
import type { State } from "./domain";
export type Conflict = { key: string; local: Change; remote: Document | null };
type Pending = Change & { nonce: string };
type Meta = {
  remote: Record<string, Document>;
  pending: Record<string, Pending>;
  conflicts: Conflict[];
};
export type SyncStatus = {
  phase: "loading" | "syncing" | "synced" | "offline" | "error";
  pending: number;
  conflicts: Conflict[];
  lastSync: string;
  error: string;
};
export class CloudSync {
  meta: Meta = { remote: {}, pending: {}, conflicts: [] };
  state: State;
  revision = 0;
  busy = false;
  stopped = false;
  timer: ReturnType<typeof setInterval> | undefined;
  lastSync = "";
  constructor(
    public owner: string,
    initial: State,
    public apply: (s: State) => void,
    public status: (s: SyncStatus) => void,
  ) {
    this.state = initial;
  }
  report(phase: SyncStatus["phase"], error = "") {
    if (!this.stopped)
      this.status({
        phase,
        pending: Object.keys(this.meta.pending).length,
        conflicts: this.meta.conflicts,
        lastSync: this.lastSync,
        error,
      });
  }
  async saveMeta() {
    await cacheSet(`sync:${this.owner}`, this.meta);
  }
  async initialize() {
    this.meta = (await cacheGet<Meta>(`sync:${this.owner}`)) ?? this.meta;
    this.report("loading");
    try {
      await this.pull();
      if (
        !Object.keys(this.meta.remote).length &&
        !Object.keys(this.meta.pending).length
      ) {
        for (const [key, payload] of Object.entries(flatten(this.state)))
          this.meta.pending[key] = {
            key,
            payload,
            deleted: false,
            expected_version: 0,
            nonce: crypto.randomUUID(),
          };
        await this.saveMeta();
      }
      await this.flush();
    } catch (e) {
      this.report(navigator.onLine ? "error" : "offline", (e as Error).message);
    }
    if (!this.stopped) {
      this.timer = setInterval(() => this.run(), 20000);
      window.addEventListener("online", this.online);
    }
  }
  online = () => {
    this.run();
  };
  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    window.removeEventListener("online", this.online);
  }
  async capture(previous: State, next: State) {
    this.revision++;
    this.state = next;
    const versions = Object.fromEntries(
      Object.entries(this.meta.remote).map(([key, d]) => [key, d.version]),
    );
    for (const c of changesBetween(previous, next, versions)) {
      const pending = this.meta.pending[c.key];
      this.meta.pending[c.key] = {
        ...c,
        expected_version: pending?.expected_version ?? c.expected_version,
        nonce: crypto.randomUUID(),
      };
      const conflict = this.meta.conflicts.find((x) => x.key === c.key);
      if (conflict) conflict.local = c;
    }
    await this.saveMeta();
    this.report(navigator.onLine ? "syncing" : "offline");
    void this.run();
  }
  async pull() {
    if (!supabase) return;
    const rows: Document[] = [];
    let start = 0;
    while (true) {
      const { data, error } = await supabase
        .from("rafiq_documents")
        .select("key,payload,version,deleted")
        .eq("user_id", this.owner)
        .order("key")
        .range(start, start + 999);
      if (error)
        throw Error(
          error.code === "PGRST205" || error.code === "42P01"
            ? "جداول رفيق غير منشأة بعد. نفّذ ملف SQL المرفق أولاً."
            : "تعذرت قراءة السجل السحابي؛ راجع الاتصال والصلاحيات",
        );
      rows.push(...(data as Document[]));
      if (data.length < 1000) break;
      start += 1000;
    }
    if (this.stopped) return;
    for (const d of rows) this.meta.remote[d.key] = d;
    for (const [key, payload] of Object.entries(flatten(this.state))) {
      if (!this.meta.remote[key] && !this.meta.pending[key])
        this.meta.pending[key] = {
          key,
          payload,
          deleted: false,
          expected_version: 0,
          nonce: crypto.randomUUID(),
        };
    }
    await this.rebuild();
    await this.saveMeta();
  }
  async photoData(documents: Document[]) {
    if (!supabase) return {};
    const photos: Record<string, string> = {};
    for (const d of documents) {
      if (d.deleted || !d.key.startsWith("photos:")) continue;
      const p = d.payload as { id: string; file?: string };
      const cached = this.state.photos.find((x) => x.id === p.id);
      if (cached) {
        photos[p.id] = cached.data;
        continue;
      }
      if (!p.file?.startsWith(this.owner + "/"))
        throw Error("مسار الصورة لا يطابق حسابك");
      const { data, error } = await supabase.storage
        .from("rafiq-private")
        .download(p.file);
      if (error)
        throw Error("تعذر تحميل إحدى صورك الخاصة؛ جرّب المزامنة مرة ثانية");
      photos[p.id] = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(data);
      });
    }
    return photos;
  }
  async rebuild() {
    const revision = this.revision;
    const effective = new Map(Object.entries(this.meta.remote));
    for (const [key, p] of Object.entries(this.meta.pending))
      effective.set(key, { ...p, version: p.expected_version });
    if (!effective.size) return;
    const documents = [...effective.values()];
    const images = await this.photoData(documents);
    if (this.stopped || revision !== this.revision) return;
    const next = hydrate(this.state, documents, images);
    await persist(next, this.owner);
    if (this.stopped || revision !== this.revision) {
      await persist(this.state, this.owner);
      return;
    }
    this.state = next;
    this.apply(next);
  }
  async flush() {
    if (!supabase || this.stopped) return;
    const conflicted = new Set(this.meta.conflicts.map((x) => x.key));
    const pending = Object.values(this.meta.pending)
      .filter((p) => !conflicted.has(p.key))
      .slice(0, 100);
    if (!pending.length) {
      this.report(
        this.meta.conflicts.length
          ? "error"
          : Object.keys(this.meta.pending).length
            ? "syncing"
            : "synced",
        this.meta.conflicts.length
          ? "عندك تعديلات متعارضة تحتاج تختار النسخة المناسبة"
          : "",
      );
      return;
    }
    this.report("syncing");
    const changes: Change[] = [];
    for (const p of pending) {
      let payload = p.payload;
      if (p.key.startsWith("photos:") && !p.deleted) {
        const photo = this.state.photos.find((x) => x.id === p.key.slice(7));
        if (!photo) throw Error("الصورة المحلية غير متوفرة للرفع");
        const file = `${this.owner}/${photo.id}.jpg`;
        const blob = await (await fetch(photo.data)).blob();
        const { error } = await supabase.storage
          .from("rafiq-private")
          .upload(file, blob, { contentType: "image/jpeg", upsert: true });
        if (error)
          throw Error("تعذر رفع الصورة للمخزن الخاص؛ راجع سياسات Storage");
        payload = { ...(p.payload as object), file };
      }
      changes.push({
        key: p.key,
        payload,
        deleted: p.deleted,
        expected_version: p.expected_version,
      });
    }
    const { data, error } = await supabase.rpc("rafiq_apply_changes", {
      p_changes: changes,
    });
    if (error)
      throw Error("تعذر حفظ المزامنة. تأكد من تنفيذ دالة SQL والصلاحيات.");
    if (this.stopped) return;
    for (const result of data as {
      key: string;
      status: string;
      remote: Document | null;
    }[]) {
      const sent = pending.find((p) => p.key === result.key)!;
      const current = this.meta.pending[result.key];
      if (result.remote) this.meta.remote[result.key] = result.remote;
      const same =
        result.remote &&
        JSON.stringify(result.remote.payload) ===
          JSON.stringify(changes.find((c) => c.key === result.key)?.payload) &&
        result.remote.deleted === sent.deleted;
      if (result.status === "saved" || same) {
        if (current?.nonce === sent.nonce) delete this.meta.pending[result.key];
        else if (current && result.remote)
          current.expected_version = result.remote.version;
        if (sent.deleted && sent.key.startsWith("photos:")) {
          const { error: removeError } = await supabase.storage
            .from("rafiq-private")
            .remove([`${this.owner}/${sent.key.slice(7)}.jpg`]);
          if (removeError)
            this.report(
              "error",
              "حُذف سجل الصورة؛ تعذر حذف الملف السحابي ويحتاج إعادة محاولة",
            );
        }
      } else if (current) {
        this.meta.conflicts = this.meta.conflicts.filter(
          (x) => x.key !== result.key,
        );
        this.meta.conflicts.push({
          key: result.key,
          local: current,
          remote: result.remote,
        });
      }
    }
    await this.saveMeta();
    this.lastSync = new Date().toISOString();
    this.report(
      this.meta.conflicts.length
        ? "error"
        : Object.keys(this.meta.pending).length
          ? "syncing"
          : "synced",
      this.meta.conflicts.length ? "عندك تعارضات تحتاج مراجعة" : "",
    );
  }
  async run() {
    if (this.busy || this.stopped) return;
    if (!navigator.onLine) {
      this.report("offline");
      return;
    }
    this.busy = true;
    try {
      await this.flush();
      await this.pull();
      await this.flush();
    } catch (e) {
      this.report(navigator.onLine ? "error" : "offline", (e as Error).message);
    } finally {
      this.busy = false;
    }
  }
  async resolve(key: string, choice: "local" | "remote") {
    const conflict = this.meta.conflicts.find((x) => x.key === key);
    if (!conflict) return;
    if (choice === "local") {
      this.meta.pending[key] = {
        ...conflict.local,
        expected_version: conflict.remote?.version ?? 0,
        nonce: crypto.randomUUID(),
      };
    } else delete this.meta.pending[key];
    this.meta.conflicts = this.meta.conflicts.filter((x) => x.key !== key);
    await this.saveMeta();
    await this.rebuild();
    void this.run();
  }
}
