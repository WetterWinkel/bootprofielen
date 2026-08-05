/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

const PROFILE_MESSAGE =
  "Captain AI werkt met uw persoonlijke bootgegevens. Log in en maak eerst gratis een bootprofiel om Captain AI te gebruiken.";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);
    return json({
      success: true,
      requiresProfile: true,
      remaining: 0,
      message: PROFILE_MESSAGE,
    });
  } catch (error: any) {
    return json(
      { success: false, message: error?.message || "Sessie ophalen mislukt" },
      400,
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);
    return json(
      {
        success: false,
        requiresProfile: true,
        paymentRequired: false,
        message: PROFILE_MESSAGE,
      },
      403,
    );
  } catch (error: any) {
    return json(
      { success: false, message: error?.message || "Sessie ophalen mislukt" },
      400,
    );
  }
}
