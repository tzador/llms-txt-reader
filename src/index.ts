const port = Bun.env.PORT ?? 3000;

Bun.serve({
	routes: {
		"/favicon.ico": Bun.file("./static/favicon.ico"),
		"/robots.txt": Bun.file("./static/robots.txt"),
		"/github-markdown.css": Bun.file("./static/github-markdown.css"),
		"/style.css": Bun.file("./static/style.css"),
		"/": Bun.file("./static/index.html"),
	},
	fetch(_req) {
		return new Response("Hello, world!");
	},
	port,
});

console.log(`Server is running on http://localhost:${port}`);
