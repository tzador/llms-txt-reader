import rehypeSanitize, {
	defaultSchema,
	type Options as SanitizeSchema,
} from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { Transformer } from "unified";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { serveFile } from "@std/http/file-server";

Deno.serve(async (req) => {
	const pathname = new URL(req.url).pathname;

	if (pathname === "/robots.txt") {
		return await serveFile(req, "./static/robots.txt");
	}

	if (pathname === "/favicon.ico") {
		return await serveFile(req, "./static/favicon.ico");
	}

	if (pathname === "/github-markdown.css") {
		return await serveFile(req, "./static/github-markdown.css");
	}

	if (pathname === "/style.css") {
		return await serveFile(req, "./static/style.css");
	}

	if (pathname === "/") {
		return await serveFile(req, "./static/index.html");
	}

	const original = req.url.split("/").slice(3).join("/");

	try {
		new URL(original);
	} catch {
		return new Response("400 Bad Request", { status: 400 });
	}

	const response = await fetch(original);

	if (!response.ok) {
		return new Response(
			`Source server error: ${response.status} ${response.statusText}`,
			{ status: response.status },
		);
	}

	const md = await response.text();
	return await renderMarkdown(req, new URL(original), md);
});

const schema: SanitizeSchema = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		a: [
			...(defaultSchema.attributes?.a || []),
			["rel", "noopener", "noreferrer", "nofollow"],
			["target", "_blank"],
		],
	},
};

function rehypeRewriteMdLinks(opts: {
	baseUrl: URL;
	serviceOrigin: string;
}): Transformer {
	return function transform(tree: any) {
		visit(tree, "element", (node: any) => {
			if (node.tagName !== "a") return;
			const href = node.properties?.href;
			if (!href) return;

			const resolved = new URL(href, opts.baseUrl);

			if (
				/\.md$/i.test(resolved.pathname) ||
				/\.txt$/i.test(resolved.pathname) ||
				resolved.pathname.endsWith("/llms.txt") ||
				resolved.pathname.endsWith("/llms-full.txt")
			) {
				const proxied = `${opts.serviceOrigin}/${resolved.toString()}`;
				if (node.properties) {
					node.properties.href = proxied;
					node.properties.rel = "noopener noreferrer nofollow";
				}
			} else {
				if (node.properties) {
					node.properties.href = resolved.toString();
					node.properties.rel = "noopener noreferrer nofollow";
				}
			}
		});

		return tree;
	};
}

async function renderMarkdown(
	request: Request,
	url: URL,
	md: string,
): Promise<Response> {
	const serviceOrigin = new URL(request.url).origin;

	const file = await unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkRehype, { allowDangerousHtml: false })
		.use(rehypeRewriteMdLinks, { baseUrl: url, serviceOrigin })
		.use(rehypeSanitize, schema)
		.use(rehypeStringify)
		.process(md);

	return new Response(
		`<!DOCTYPE html>
<html>
  <head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-342R70MJZY"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-342R70MJZY');
    </script>
    <title>llms.txt reader</title>
    <link rel="stylesheet" href="/github-markdown.css" type="text/css">
    <link rel="stylesheet" href="/style.css" type="text/css">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body>
    <main class="markdown-body">
      <a href="${url.toString()}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>
      ${file.value}
    </main>
  </body>
</html>
`,
		{
			headers: {
				"Content-Type": "text/html; charset=utf-8",
			},
		},
	);
}
