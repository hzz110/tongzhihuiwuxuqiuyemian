export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare("SELECT value FROM app_data WHERE key = 'state'").all();
    if (results && results.length > 0) {
      return new Response(results[0].value, {
        headers: { "content-type": "application/json;charset=UTF-8" },
      });
    }
    // 默认数据，兼容两种密码属性名称
    const defaultData = {
      items: [],
      isLocked: false,
      passwords: { admin: "admin123", client: "123456", adminPassword: "admin123", clientPassword: "123456" }
    };
    return new Response(JSON.stringify(defaultData), {
      headers: { "content-type": "application/json;charset=UTF-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();

    // 确保 passwords 结构完整，避免属性丢失
    if (body.passwords) {
      const adminPass = body.passwords.admin || body.passwords.adminPassword || "admin123";
      const clientPass = body.passwords.client || body.passwords.clientPassword || "123456";
      body.passwords = {
        admin: adminPass,
        client: clientPass,
        adminPassword: adminPass,
        clientPassword: clientPass
      };
    }

    const jsonString = JSON.stringify(body);

    await env.DB.prepare(
      "INSERT INTO app_data (key, value) VALUES ('state', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1"
    ).bind(jsonString).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "content-type": "application/json;charset=UTF-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
