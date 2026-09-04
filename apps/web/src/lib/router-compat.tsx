"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  type AnchorHTMLAttributes,
} from "react";


type RouteParams = Record<
  string,
  string | number
>;


type RouterLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  to: string;
  params?: RouteParams;
  hash?: string;
};


function resolvePath(
  to: string,
  params?: RouteParams,
  hash?: string,
): string {
  let path = to;

  if (params) {
    for (
      const [key, value]
      of Object.entries(params)
    ) {
      const encoded =
        encodeURIComponent(
          String(value)
        );

      path = path.replace(
        `$${key}`,
        encoded,
      );

      path = path.replace(
        `:${key}`,
        encoded,
      );
    }
  }

  if (hash) {
    path += hash.startsWith("#")
      ? hash
      : `#${hash}`;
  }

  return path;
}


export const Link = forwardRef<
  HTMLAnchorElement,
  RouterLinkProps
>(function RouterCompatLink(
  {
    to,
    params,
    hash,
    ...props
  },
  ref,
) {
  return (
    <NextLink
      ref={ref}
      href={resolvePath(
        to,
        params,
        hash,
      )}
      {...props}
    />
  );
});


export function useNavigate() {
  const router = useRouter();

  return ({
    to,
    params,
    hash,
  }: {
    to: string;
    params?: RouteParams;
    hash?: string;
  }) => {
    router.push(
      resolvePath(
        to,
        params,
        hash,
      ),
    );
  };
}
