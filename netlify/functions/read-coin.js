exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  try {
    const { image } = JSON.parse(event.body);
    if (!image) return { statusCode: 400, body: JSON.stringify({ error: "no image" }) };

    const prompt = `You are a friendly numismatic expert cataloging a coin or banknote from a photo. Identify it as best you can; if worn or unclear, give your best guess and say so gently. Respond ONLY with a JSON object, no markdown:
{"name":"common name","country":"","year":"e.g. 1881 or 'c. 440 BC'","mint":"mint/place or mark, else ''","denomination":"","metal":"","est_value":"rough range like '$30-$80', ~ if unsure","tags":["3-6 short lowercase english tags like 'gold','silver','us','roman','1800s','graded','dollar'"],"blurb":"2-3 warm plain sentences in ENGLISH a non-expert would enjoy; mention if the photo made anything hard to read","blurb_he":"the SAME blurb written in natural, warm modern Hebrew"}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image } }
          ]
        }]
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: data.error ? data.error.message : "openai error" }) };
    }
    let txt = (data.choices && data.choices[0] && data.choices[0].message.content) || "";
    const m = txt.match(/\{[\s\S]*\}/);
    const json = m ? m[0] : "{}";
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: json
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
