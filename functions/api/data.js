export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare("SELECT value FROM app_data WHERE key = 'state'").all();
    if (results && results.length > 0) {
      return new Response(results[0].value, {
        headers: { "content-type": "application/json;charset=UTF-8" },
      });
    }
    // 默认数据
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

    // 1. 先从数据库读取已保存的数据，获取现有密码
    let existingPasswords = { admin: "admin123", client: "123456" };
    try {
      const { results } = await env.DB.prepare("SELECT value FROM app_data WHERE key = 'state'").all();
      if (results && results.length > 0) {
        const oldState = JSON.parse(results[0].value);
        if (oldState.passwords) {
          existingPasswords = oldState.passwords;
        }
      }
    } catch (dbErr) {
      console.error("读取数据库现有状态失败:", dbErr);
    }

    // 2. 判断本次请求是否传入了新密码，如果传入了就用新的，没有就保持数据库里的旧密码
    let adminPass = existingPasswords.admin || existingPasswords.adminPassword || "admin123";
    let clientPass = existingPasswords.client || existingPasswords.clientPassword || "123456";

    if (body.passwords) {
      adminPass = body.passwords.admin || body.passwords.adminPassword || adminPass;
      clientPass = body.passwords.client || body.passwords.clientPassword || clientPass;
    }

    // 规范化完整的 body 结构
    body.passwords = {
      admin: adminPass,
      client: clientPass,
      adminPassword: adminPass,
      clientPassword: clientPass
    };

    const jsonString = JSON.stringify(body);

    // 3. 写入 D1 数据库
    await env.DB.prepare(
      "INSERT INTO app_data (key, value) VALUES ('state', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1"
    ).bind(jsonString).run();

    return new Response(JSON.stringify({ success: true, data: body }), {
      headers: { "content-type": "application/json;charset=UTF-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
