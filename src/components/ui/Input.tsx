import { InputHTMLAttributes, LabelHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      className={`w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 ${className}`}
      {...rest}
    />
  );
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  const { className = "", ...rest } = props;
  return (
    <label
      className={`mb-1.5 block text-sm font-medium text-slate-700 ${className}`}
      {...rest}
    />
  );
}
