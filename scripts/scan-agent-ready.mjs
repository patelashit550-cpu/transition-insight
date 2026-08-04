const url = process.argv[2] || "https://ashitmilne.xyz";
const res = await fetch("https://isitagentready.com/api/scan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url }),
});
const data = await res.json();
const sitemap = data.checks?.discoverability?.sitemap;
console.log(JSON.stringify({ url, sitemap, robots: data.checks?.discoverability?.robots }, null, 2));
