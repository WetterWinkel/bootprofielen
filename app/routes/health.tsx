import type {LoaderFunctionArgs} from "react-router";

export function loader(_args: LoaderFunctionArgs) {
  return Response.json({status: "ok"}, {
    headers: {"Cache-Control": "no-store"},
  });
}
