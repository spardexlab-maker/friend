import defaults from "./cloud-public.json";
import { createClient } from "@supabase/supabase-js";
import { cloudFetch } from "./cloud-fetch";
const url = import.meta.env.VITE_SUPABASE_URL || defaults.url;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || defaults.key;
export const cloudEnabled =
  (import.meta.env.VITE_CLOUD_ENABLED
    ? import.meta.env.VITE_CLOUD_ENABLED === "true"
    : import.meta.env.PROD) && Boolean(url && key);
export const supabase =
  url && key
    ? createClient(url, key, {
        global: { fetch: cloudFetch },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
export const cloudUrl = url;
export async function cloudApi(operation: string, body: unknown = {}) {
  if (!supabase) throw Error("إعداد Supabase غير مكتمل");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw Error("سجّل الدخول أولاً");
  const { data, error } = await supabase.functions.invoke("rafiq-ai", {
    body: { operation, ...(body as object) },
  });
  if (error) {
    let message = "تعذر الاتصال بخادم رفيق السحابي";
    if (error.context instanceof Response) {
      const result = await error.context.json().catch(() => ({}));
      message = result.error ?? message;
    }
    throw Error(message);
  }
  return data;
}
