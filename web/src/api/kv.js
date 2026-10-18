const API_BASE = '/kv';

export const getStoredToken = () => localStorage.getItem('liukv_token') || '';
export const setStoredToken = (token) => {
  if (token) {
    localStorage.setItem('liukv_token', token);
  } else {
    localStorage.removeItem('liukv_token');
  }
};

const request = async (url, options = {}) => {
  const token = getStoredToken();
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['X-KV-Token'] = token;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  return res;
};

export const api = {
  // 认证接口
  getAuthStatus: async () => {
    const res = await fetch('/api/auth/status');
    return res.json();
  },

  verifyToken: async (token) => {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    if (res.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    return res.json();
  },

  // Namespaces 管理
  listNamespaces: async () => {
    const res = await request(`${API_BASE}/_admin/namespaces`);
    return res.json();
  },

  createNamespace: async (namespace) => {
    const res = await request(`${API_BASE}/_admin/namespaces/${encodeURIComponent(namespace)}`, {
      method: 'POST',
    });
    return res.json();
  },

  deleteNamespace: async (namespace) => {
    const res = await request(`${API_BASE}/_admin/namespaces/${encodeURIComponent(namespace)}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // 统计指标
  getAllStats: async () => {
    const res = await request(`${API_BASE}/_admin/stats`);
    return res.json();
  },

  getStats: async (namespace) => {
    const res = await request(`${API_BASE}/${encodeURIComponent(namespace)}/_stats`);
    return res.json();
  },

  // KV 操作
  listKeys: async (namespace, prefix = '') => {
    const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    const res = await request(`${API_BASE}/${encodeURIComponent(namespace)}/_keys${query}`);
    return res.json();
  },

  getKey: async (namespace, key) => {
    const res = await request(`${API_BASE}/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error('NOT_FOUND');
      throw new Error(`HTTP ${res.status}`);
    }
    return res.text();
  },

  putKey: async (namespace, key, value, ttl = 0) => {
    const query = ttl > 0 ? `?ttl=${ttl}` : '';
    const res = await request(`${API_BASE}/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}${query}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: value,
    });
    return res.json();
  },

  deleteKey: async (namespace, key) => {
    const res = await request(`${API_BASE}/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  incrKey: async (namespace, key, amount = 1) => {
    const res = await request(
      `${API_BASE}/${encodeURIComponent(namespace)}/_incr/${encodeURIComponent(key)}?amount=${amount}`,
      { method: 'POST' }
    );
    return res.json();
  },

  clearNamespace: async (namespace) => {
    const res = await request(`${API_BASE}/${encodeURIComponent(namespace)}/_clear`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // 健康检测
  health: async () => {
    const res = await fetch('/health');
    return res.json();
  },
};
