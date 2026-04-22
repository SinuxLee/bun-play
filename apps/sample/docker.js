const response = await fetch("http://localhost/info", {
  unix: "/var/run/docker.sock",
});

const data = await response.json();
console.log(JSON.stringify(Object.keys(data))); // <uuid>

