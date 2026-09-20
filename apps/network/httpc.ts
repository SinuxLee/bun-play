import { fetch } from "bun";

const request = new Request("https://httpbin.org/anything/data", {
  method: "POST",
  body: "Hello, world!",
});

const response = await fetch(request);
if (response.ok) {
  console.log("Request successful!");
  const data = await response.json();
  console.log(data);
} else {
  console.error("Request failed!");
}
