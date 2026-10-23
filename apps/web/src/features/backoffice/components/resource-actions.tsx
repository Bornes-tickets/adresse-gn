"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CircleAlert,
  Loader2,
  X,
} from "lucide-react";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  handleBackofficeActionResult,
} from "../client-exports";

import {
  type BackofficeActionDefinition,
  executeBackofficeAction,
  executeBackofficeFileAction,
  getBackofficeActionCatalog,
} from "../api";


type Row = Record<string, unknown>;
type FormValue = string | boolean | File | null;
type FormState = Record<string, FormValue>;


function actionVisible(
  action: BackofficeActionDefinition,
  row: Row | null,
) {
  if(!action.when || !row){
    return true;
  }

  return Object.entries(
    action.when,
  ).every(
    ([key, accepted]) =>
      accepted.includes(
        String(
          row[key] ?? "",
        ),
      ),
  );
}


function initialValue(
  action: BackofficeActionDefinition,
  row: Row | null,
): FormState {
  const state: FormState = {};

  for(const field of action.fields){
    const source =
      field.default_from
        ? row?.[field.default_from]
        : undefined;

    if(field.kind === "file"){
      state[field.name] = null;
      continue;
    }

    if(field.kind === "boolean"){
      state[field.name] =
        typeof source === "boolean"
          ? source
          : String(source ?? "").toLowerCase() === "true";

      continue;
    }

    if(field.kind === "json"){
      if(
        source !== undefined
        && source !== null
        && typeof source === "object"
      ){
        state[field.name] =
          JSON.stringify(
            source,
            null,
            2,
          );
      }
      else{
        state[field.name] =
          String(
            source ?? "",
          );
      }

      continue;
    }

    if(
      field.kind === "datetime-local"
      && typeof source === "string"
    ){
      state[field.name] =
        source.slice(
          0,
          16,
        );

      continue;
    }

    state[field.name] =
      String(
        source ?? "",
      );
  }

  return state;
}


function ActionModal({
  resource,
  action,
  row,
  onClose,
  onComplete,
}: {
  resource: string;
  action: BackofficeActionDefinition;
  row: Row | null;
  onClose: () => void;
  onComplete: () => void | Promise<void>;
}) {
  const [
    values,
    setValues,
  ] = useState<FormState>(
    () => initialValue(
      action,
      row,
    ),
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  async function submit(){
    if(
      action.confirm
      && !window.confirm(
        action.confirm,
      )
    ){
      return;
    }

    for(const field of action.fields){
      if(
        field.required
        && field.kind !== "boolean"
        && (
          field.kind === "file"
            ? !(values[field.name] instanceof File)
            : !String(
                values[field.name]
                ?? "",
              ).trim()
        )
      ){
        setError(
          `${field.label} est obligatoire.`,
        );

        return;
      }
    }

    setSaving(true);
    setError("");

    try{
      const token =
        await getAccessToken();

      if(!token){
        throw new Error(
          "Session expirée.",
        );
      }

      const actionData: Record<string, unknown> = {
        ...values,
        _origin: window.location.origin,
      };

      const hasFile =
        Object.values(actionData).some(
          (value) =>
            value instanceof File,
        );

      const result =
        hasFile
          ? await executeBackofficeFileAction(
              token,
              resource,
              action.key,
              {
                rowId:
                  row?.id
                    ? String(row.id)
                    : null,
                data: actionData,
              },
            )
          : await executeBackofficeAction(
              token,
              resource,
              action.key,
              {
                rowId:
                  row?.id
                    ? String(row.id)
                    : null,
                data: actionData,
              },
            );

      await handleBackofficeActionResult(
        result,
      );

      await onComplete();
      onClose();
    }
    catch(actionError){
      setError(
        actionError instanceof Error
          ? actionError.message
          : "L’action n’a pas pu être exécutée.",
      );
    }
    finally{
      setSaving(false);
    }
  }


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <section className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Action métier
            </p>

            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {action.label}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border p-2"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {error && (
            <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {action.fields.map(
            (field) => {
              if(field.kind === "hidden"){
                return null;
              }

              const value =
                values[field.name];

              return (
                <label
                  key={field.name}
                  className="block space-y-1.5"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {field.label}
                    {field.required
                      ? " *"
                      : ""}
                  </span>

                  {field.kind === "select"
                    ? (
                        <select
                          value={String(value ?? "")}
                          onChange={(event) =>
                            setValues(
                              (current) => ({
                                ...current,
                                [field.name]:
                                  event.target.value,
                              }),
                            )
                          }
                          className="h-11 w-full rounded-xl border px-3 text-sm"
                        >
                          <option value="">
                            Sélectionner…
                          </option>

                          {(field.options ?? []).map(
                            (option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ),
                          )}
                        </select>
                      )
                    : field.kind === "textarea"
                      || field.kind === "json"
                      ? (
                          <textarea
                            rows={
                              field.kind === "json"
                                ? 8
                                : 4
                            }
                            value={String(value ?? "")}
                            onChange={(event) =>
                              setValues(
                                (current) => ({
                                  ...current,
                                  [field.name]:
                                    event.target.value,
                                }),
                              )
                            }
                            className="w-full rounded-xl border px-3 py-2 text-sm font-mono"
                          />
                        )
                      : field.kind === "boolean"
                        ? (
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(event) =>
                                setValues(
                                  (current) => ({
                                    ...current,
                                    [field.name]:
                                      event.target.checked,
                                  }),
                                )
                              }
                              className="h-5 w-5"
                            />
                          )
                        : field.kind === "file"
                          ? (
                              <input
                                type="file"
                                accept=".pdf,image/jpeg,image/png"
                                onChange={(event) =>
                                  setValues(
                                    (current) => ({
                                      ...current,
                                      [field.name]:
                                        event.target.files?.[0]
                                        ?? null,
                                    }),
                                  )
                                }
                                className="block w-full rounded-xl border px-3 py-2 text-sm"
                              />
                            )
                          : (
                              <input
                                type={
                                  field.kind === "number"
                                    ? "number"
                                    : field.kind === "date"
                                      ? "date"
                                      : field.kind === "datetime-local"
                                        ? "datetime-local"
                                        : field.kind === "password"
                                          ? "password"
                                          : "text"
                                }
                                value={String(value ?? "")}
                                onChange={(event) =>
                                  setValues(
                                    (current) => ({
                                      ...current,
                                      [field.name]:
                                        event.target.value,
                                    }),
                                  )
                                }
                                autoComplete={
                                  field.kind === "password"
                                    ? "new-password"
                                    : undefined
                                }
                                className="h-11 w-full rounded-xl border px-3 text-sm"
                              />
                            )}

                  {field.help && (
                    <span className="block text-xs text-slate-400">
                      {field.help}
                    </span>
                  )}
                </label>
              );
            },
          )}
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-2 border-t bg-white px-5 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Annuler
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void submit()
            }
            className={[
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50",
              action.variant === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-slate-950 hover:bg-slate-800",
            ].join(" ")}
          >
            {saving && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Confirmer
          </button>
        </footer>
      </section>
    </div>
  );
}


export function ResourceActionButtons({
  resource,
  actions,
  row,
  scope,
  onComplete,
}: {
  resource: string;
  actions: BackofficeActionDefinition[];
  row: Row | null;
  scope: "row" | "global";
  onComplete: () => void | Promise<void>;
}) {
  const available =
    useMemo(
      () => actions.filter(
        (item) =>
          item.scope === scope
          && actionVisible(
            item,
            row,
          ),
      ),
      [actions, row, scope],
    );

  const [
    active,
    setActive,
  ] = useState<BackofficeActionDefinition | null>(null);

  if(!available.length){
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {available.map(
          (item) => (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                setActive(item)
              }
              className={[
                "rounded-lg border px-3 py-2 text-xs font-medium",
                item.variant === "danger"
                  ? "border-red-200 text-red-700 hover:bg-red-50"
                  : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {item.label}
            </button>
          ),
        )}
      </div>

      {active && (
        <ActionModal
          resource={resource}
          action={active}
          row={row}
          onClose={() =>
            setActive(null)
          }
          onComplete={onComplete}
        />
      )}
    </>
  );
}


export function StandaloneResourceActions({
  resource,
  row,
  onComplete,
}: {
  resource: string;
  row: Row;
  onComplete: () => void | Promise<void>;
}) {
  const [
    actions,
    setActions,
  ] = useState<BackofficeActionDefinition[]>([]);

  useEffect(() => {
    const controller =
      new AbortController();

    async function load(){
      const token =
        await getAccessToken();

      if(!token){
        return;
      }

      try{
        const result =
          await getBackofficeActionCatalog(
            token,
            resource,
            controller.signal,
          );

        if(!controller.signal.aborted){
          setActions(
            result.actions,
          );
        }
      }
      catch{
        if(!controller.signal.aborted){
          setActions([]);
        }
      }
    }

    void load();

    return () =>
      controller.abort();
  },[
    resource,
  ]);

  return (
    <ResourceActionButtons
      resource={resource}
      actions={actions}
      row={row}
      scope="row"
      onComplete={onComplete}
    />
  );
}
