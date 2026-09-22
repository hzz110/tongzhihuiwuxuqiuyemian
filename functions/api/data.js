// functions/api/data.js

export async function onRequestGet(context) {
  const db = context.env.DB; // 在 Pages 设置中绑定的 D1 变量名

  try {
    // 1. 获取所有 items
    const { results: itemsRaw } = await db.prepare("SELECT * FROM items ORDER BY order_index ASC").all();
    
    // 解析 images 字段（从 JSON 字符串转回数组）
    const items = itemsRaw.map(item => ({
      ...item,
      images: item.images ? JSON.parse(item.images) : []
    }));

    // 2. 获取设置
    const { results: settingsRaw } = await db.prepare("SELECT * FROM settings").all();
    const settings = {};
    settingsRaw.forEach(row => {
      settings[row.key] = row.value;
    });

    return new Response(JSON.stringify({
      items,
      isLocked: settings.isLocked === 'true',
      passwords: {
        admin: settings.adminPass || 'admin123',
        client: settings.clientPass || '123456'
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestPost(context) {
  const db = context.env.DB;

  try {
    const body = await context.request.json();
    const { items, isLocked, passwords } = body;

    // 1. 更新或清空重建 items
    if (Array.isArray(items)) {
      // 简化处理：采用全量覆盖插入（事务处理）
      await db.batch([
        db.prepare("DELETE FROM items"),
        ...items.map((item, idx) => 
          db.prepare("INSERT INTO items (id, title, images, answer, order_index) VALUES (?, ?, ?, ?, ?)")
            .bind(item.id, item.title, JSON.stringify(item.images || []), item.answer || '', idx)
        )
      ]);
    }

    // 2. 更新设置
    if (typeof isLocked === 'boolean') {
      await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('isLocked', ?)").bind(String(isLocked)).run();
    }

    if (passwords) {
      if (passwords.admin) {
        await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('adminPass', ?)").bind(passwords.admin).run();
      }
      if (passwords.client) {
        await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('clientPass', ?)").bind(passwords.client).run();
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}