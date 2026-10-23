"use client";

import type {
  FormEvent,
} from "react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  Search,
} from "lucide-react";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  type BackofficeActionDefinition,
  type BackofficeResourceResponse,
  getBackofficeActionCatalog,
  listBackofficeResource,
} from "../api";

import {
  ResourceActionButtons,
} from "./resource-actions";


function looksLikeIsoDate(
  value: string,
) {
  return /^\d{4}-\d{2}-\d{2}(T|\s)/.test(
    value,
  );
}


function formatValue(
  key: string,
  value: unknown,
): string {
  if(
    value === null
    || value === undefined
    || value === ""
  ){
    return "—";
  }

  if(
    typeof value === "boolean"
  ){
    return value
      ? "Oui"
      : "Non";
  }

  if(
    typeof value === "number"
  ){
    const monetary =
      /amount|price|prix|montant|revenu|encaissement/i
        .test(key);

    const formatted =
      new Intl.NumberFormat(
        "fr-FR",
      ).format(value);

    return monetary
      ? `${formatted} GNF`
      : formatted;
  }

  if(
    typeof value === "object"
  ){
    const json =
      JSON.stringify(
        value,
      );

    if(!json){
      return "—";
    }

    return (
      json.length > 180
        ? `${json.slice(0, 177)}…`
        : json
    );
  }

  const text =
    String(value);

  if(looksLikeIsoDate(text)){
    const parsed =
      new Date(text);

    if(
      !Number.isNaN(
        parsed.getTime(),
      )
    ){
      return new Intl.DateTimeFormat(
        "fr-FR",
        {
          dateStyle: "medium",
          timeStyle: "short",
        },
      ).format(parsed);
    }
  }

  return text;
}


function cellClass(
  key: string,
) {
  if(
    key === "status"
    || key.endsWith(
      "_status",
    )
    || key === "role"
    || key === "niveau"
  ){
    return (
      "inline-flex rounded-full "
      + "bg-slate-100 px-2.5 py-1 "
      + "text-xs font-medium "
      + "text-slate-700"
    );
  }

  return "";
}


export function ResourcePage({
  title,
  subtitle,
  resource,
}: {
  title: string;
  subtitle: string;
  resource: string;
}) {
  const [
    data,
    setData,
  ] = useState<
    BackofficeResourceResponse | null
  >(null);

  const [
    actions,
    setActions,
  ] = useState<BackofficeActionDefinition[]>([]);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    queryDraft,
    setQueryDraft,
  ] = useState("");

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    revision,
    setRevision,
  ] = useState(0);

  const [
    error,
    setError,
  ] = useState("");


  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const token =
          await getAccessToken();

        if (!token) {
          throw new Error(
            "Session expirée.",
          );
        }

        const [
          resourceResult,
          actionResult,
        ] = await Promise.all([
          listBackofficeResource(
            token,
            resource,
            {
              page,
              pageSize: 25,
              query,
            },
            controller.signal,
          ),
          getBackofficeActionCatalog(
            token,
            resource,
            controller.signal,
          ),
        ]);

        if(
          controller.signal.aborted
        ){
          return;
        }

        setData(resourceResult);
        setActions(actionResult.actions);
      }
      catch(loadError){
        if(
          controller.signal.aborted
        ){
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger ces données.",
        );
      }
      finally{
        if(
          !controller.signal.aborted
        ){
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  },[
    page,
    query,
    resource,
    revision,
  ]);


  const totalPages =
    useMemo(
      () => {
        if(!data){
          return 1;
        }

        return Math.max(
          1,
          Math.ceil(
            data.total
            / data.page_size,
          ),
        );
      },
      [data],
    );

  const hasRowActions =
    actions.some(
      (item) =>
        item.scope === "row",
    );


  function submitSearch(
    event: FormEvent,
  ){
    event.preventDefault();

    setPage(1);

    setQuery(
      queryDraft.trim(),
    );
  }


  function reload(){
    setRevision(
      (value) =>
        value + 1,
    );
  }


  return (
    <div className="mx-auto max-w-[1700px] space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <Database className="h-4 w-4" />
            Parité fonctionnelle historique
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            {subtitle}
          </p>

          <div className="mt-4">
            <ResourceActionButtons
              resource={resource}
              actions={actions}
              row={null}
              scope="global"
              onComplete={reload}
            />
          </div>
        </div>

        {data && (
          <div className="rounded-xl border bg-white px-5 py-3 text-right shadow-sm">
            <p className="text-xs text-slate-500">
              Total
            </p>

            <p className="text-2xl font-semibold text-slate-950">
              {new Intl.NumberFormat(
                "fr-FR",
              ).format(
                data.total,
              )}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={queryDraft}
              onChange={(event) =>
                setQueryDraft(
                  event.target.value,
                )
              }
              placeholder="Rechercher dans les données…"
              className="h-11 w-full rounded-xl border bg-white pl-10 pr-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <button
            type="submit"
            className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Rechercher
          </button>
        </form>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {(data?.columns ?? []).map(
                  (column) => (
                    <th
                      key={column.key}
                      className="whitespace-nowrap px-4 py-3"
                    >
                      {column.label}
                    </th>
                  ),
                )}

                {hasRowActions && (
                  <th className="whitespace-nowrap px-4 py-3 text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading
                ? (
                    <tr>
                      <td
                        colSpan={
                          Math.max(
                            1,
                            (data?.columns.length ?? 1)
                            + (hasRowActions ? 1 : 0),
                          )
                        }
                        className="px-6 py-16 text-center text-sm text-slate-500"
                      >
                        Chargement…
                      </td>
                    </tr>
                  )
                : data?.items.length
                  ? data.items.map(
                      (
                        row,
                        index,
                      ) => (
                        <tr
                          key={
                            String(
                              row.id
                              ?? `${page}-${index}`,
                            )
                          }
                          className="align-top hover:bg-slate-50"
                        >
                          {data.columns.map(
                            (column) => (
                              <td
                                key={column.key}
                                className="max-w-[360px] px-4 py-3 text-sm text-slate-700"
                              >
                                <span
                                  className={
                                    cellClass(
                                      column.key,
                                    )
                                  }
                                >
                                  {formatValue(
                                    column.key,
                                    row[
                                      column.key
                                    ],
                                  )}
                                </span>
                              </td>
                            ),
                          )}

                          {hasRowActions && (
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <ResourceActionButtons
                                  resource={resource}
                                  actions={actions}
                                  row={row}
                                  scope="row"
                                  onComplete={reload}
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      ),
                    )
                  : (
                      <tr>
                        <td
                          colSpan={
                            Math.max(
                              1,
                              (data?.columns.length ?? 1)
                              + (hasRowActions ? 1 : 0),
                            )
                          }
                          className="px-6 py-16 text-center text-sm text-slate-500"
                        >
                          Aucune donnée.
                        </td>
                      </tr>
                    )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="flex flex-col justify-between gap-3 border-t px-4 py-4 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-500">
              Page
              {" "}
              {data.page}
              {" / "}
              {totalPages}
              {" — "}
              {data.total}
              {" résultat(s)"}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={
                  loading
                  || page <= 1
                }
                onClick={() =>
                  setPage(
                    (value) =>
                      Math.max(
                        1,
                        value - 1,
                      ),
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>

              <button
                type="button"
                disabled={
                  loading
                  || page >= totalPages
                }
                onClick={() =>
                  setPage(
                    (value) =>
                      Math.min(
                        totalPages,
                        value + 1,
                      ),
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
