import type { ReactNode } from "react";
import { X, Plus, Utensils, Pencil, Trash2 } from "lucide-react";
import type { Meal } from "./domain";
export function Field({
  label,
  name,
  value,
  type = "number",
  min = 0,
  max = 20000,
  required = true,
  step = "any",
  placeholder,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  min?: number;
  max?: number;
  required?: boolean;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        min={min}
        max={max}
        step={step}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}
export function Select({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value?: string;
  options: [string, string][];
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-heading">
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close icon-button"
          onClick={onClose}
          aria-label="إغلاق"
        >
          <X />
        </button>
        <span className="eyebrow">تفاصيلك تبقى إلك</span>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Utensils size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="text-button" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}
export function Meals({
  meals,
  onEdit,
  onDelete,
  onAdd,
}: {
  meals: Meal[];
  onEdit: (m: Meal) => void;
  onDelete: (m: Meal) => void;
  onAdd: () => void;
}) {
  return meals.length ? (
    <>
      {meals.map((m) => (
        <div className="meal-row" key={m.id}>
          <span className="meal-icon">
            <Utensils size={19} />
          </span>
          <div className="grow">
            <h3>{m.name}</h3>
            <span className="caption">
              {m.protein} غ بروتين • {m.source}
              <br />
              {m.grams ? `${m.grams} غ • ` : ""}
              {m.preparation}
            </span>
          </div>
          <b>
            {Math.round(m.kcal)}
            <small> سعرة</small>
          </b>
          <button
            className="icon-button"
            onClick={() => onEdit(m)}
            aria-label={`تعديل ${m.name}`}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-button"
            onClick={() => onDelete(m)}
            aria-label={`حذف ${m.name}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </>
  ) : (
    <Empty
      title="أول وجبة، أول خطوة."
      text="سجّل التفاصيل، وكمل يومك على راحتك."
      action="أضف وجبتك الأولى"
      onAction={onAdd}
    />
  );
}
export function Metric({
  icon,
  title,
  value,
  unit,
  detail,
  color = "green",
}: {
  icon: ReactNode;
  title: string;
  value: string | number;
  unit: string;
  detail: string;
  color?: string;
}) {
  return (
    <Card className="metric">
      <div className="metric-title">
        <span className={`metric-icon ${color}`}>{icon}</span>
        {title}
      </div>
      <div className="metric-value">
        {value} <span>{unit}</span>
      </div>
      <div className="caption">{detail}</div>
    </Card>
  );
}
export const format = (v: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(v);
