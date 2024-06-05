const ZONE_ID = "e1b9039399ccd39d6d02705e76c47c49"; // seline.so

const url = `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`;

const options = {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
  },
  body: JSON.stringify({
    files: [{ url: "https://cdn.seline.so/seline.js" }],
  }),
};

fetch(url, options)
  .then((res) => res.json())
  .then((json) => console.log(json))
  .catch((error) => console.error(error));
