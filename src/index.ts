import { Hono } from "hono";
import { HonoEnv } from "./types";
import { accepts } from "hono/accepts";
import { paths } from "./generated/asana";
import createClient from "openapi-fetch";

const ALLOWED_ASANA_DOMAINS = new Set(["app.asana.com"]);

const app = new Hono<HonoEnv>();

app.get("/:custom_id{[A-Za-z]+-[0-9]+}", async (c) => {
  const workspaceGid = c.env.ASANA_WORKSPACE_GID!;
  const customId = c.req.param("custom_id");
  const r = await c.env.asana.GET("/workspaces/{workspace_gid}/tasks/custom_id/{custom_id}", {
    params: {
      path: {
        workspace_gid: workspaceGid,
        custom_id: customId,
      },
    },
  });

  const accept = accepts(c, {
    header: "Accept",
    supports: ["application/json"],
    default: "text/plain",
  });
  const isJson = accept === "application/json";

  if (r.error?.errors) {
    if (isJson) {
      return c.json({ errors: r.error.errors }, r.response.status as any);
    } else {
      return c.text(
        "Error: " + r.error.errors.map((e) => e.message).join(", "),
        r.response.status as any,
      );
    }
  }
  if (!r.response.ok) {
    const errorId = Math.random().toString(36).substring(2, 10);
    console.error(`Unexpected error #${errorId}`, r);
    if (isJson) {
      return c.json({ errors: [{ message: "Unknown error" }], errorId }, r.response.status as any);
    } else {
      return c.text(`Oops, something got wrong. #${errorId}`, r.response.status as any);
    }
  }
  c.header("Vary", "Content-Type");
  // Browser cache for 5 minutes, Edge cache for 10 minutes
  c.header("Cache-Control", "public, max-age=300, s-maxage=600");

  if (!isJson) {
    const link = new URL(r.data.data.permalink_url, "https://example.com");
    if (!ALLOWED_ASANA_DOMAINS.has(link.hostname)) {
      return c.text("Invalid ticket link", 400);
    }
    return c.redirect(link);
  }

  return c.json({
    workspace: r.data.data.workspace.gid,
    task: r.data.data.gid,
    projects: r.data.data.projects.map((p) => p.gid),
    url: r.data.data.permalink_url,
  });
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const asana = createClient<paths>({
      baseUrl: "https://app.asana.com/api/1.0",
      headers: {
        authorization: `Bearer ${env.ASANA_PAT!}`,
      },
    });

    return app.fetch(
      request,
      {
        ...env,
        asana,
      },
      ctx,
    );
  },
};
