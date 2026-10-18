import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Database,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Key,
  Clock,
  HardDrive,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  LogOut,
  FolderMinus,
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  ArrowRight,
  Server,
  Sun,
  Moon
} from 'lucide-react';
import { api, getStoredToken, setStoredToken } from './api/kv';

export default function App() {
  // 主题模式: 'dark' | 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('liukv-theme') || 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('liukv-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 认证状态: 'checking' | 'authenticated' | 'unauthenticated'
  const [authState, setAuthState] = useState('checking');
  const [serverRequiresAuth, setServerRequiresAuth] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // 业务状态
  const [namespaces, setNamespaces] = useState([]);
  const [currentNamespace, setCurrentNamespace] = useState('');
  const [newNamespace, setNewNamespace] = useState('');

  const [stats, setStats] = useState({ keys: 0, usedMB: 0, maxMB: 128 });
  const [keys, setKeys] = useState([]);
  const [searchPrefix, setSearchPrefix] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [keyValue, setKeyValue] = useState('');
  const [loadingKey, setLoadingKey] = useState(false);

  // 写入/编辑 表单
  const [inputKey, setInputKey] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [inputTTL, setInputTTL] = useState(0);
  const [incrStep, setIncrStep] = useState(1);

  // 通知与提示
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 3000);
  };

  // 校验当前后端服务是否需要鉴权 & 已有 Token 是否有效
  const checkAuth = async () => {
    try {
      const statusRes = await api.getAuthStatus();
      setServerRequiresAuth(statusRes.authRequired);

      if (!statusRes.authRequired) {
        // 后端未启用鉴权，直接进入
        setAuthState('authenticated');
        return;
      }

      // 启用了鉴权，检查本地是否有 Token
      const stored = getStoredToken();
      if (!stored) {
        setAuthState('unauthenticated');
        return;
      }

      // 验证本地存储的 Token 是否仍然有效
      try {
        await api.verifyToken(stored);
        setAuthState('authenticated');
      } catch (err) {
        setStoredToken('');
        setAuthState('unauthenticated');
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
      // 网络故障或服务端启动中
      setAuthState('unauthenticated');
      setLoginError('连接后端服务失败，请检查服务是否正常启动');
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // 执行登录校验
  const handleLogin = async (e) => {
    e?.preventDefault();
    const tokenToTest = tokenInput.trim();
    if (!tokenToTest) {
      setLoginError('请输入安全访问 Token');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      await api.verifyToken(tokenToTest);
      setStoredToken(tokenToTest);
      setAuthState('authenticated');
      setTokenInput('');
      showToast('登录成功，欢迎使用 LiuKV 控制台');
    } catch (err) {
      setLoginError('Token 验证失败，请确认您输入的 AUTH_TOKEN 是否正确');
    } finally {
      setLoginLoading(false);
    }
  };

  // 执行登出操作
  const handleLogout = () => {
    if (window.confirm('确定要退出当前控制台会话吗？')) {
      setStoredToken('');
      setCurrentNamespace('');
      setNamespaces([]);
      setSelectedKey(null);
      setKeyValue('');
      setAuthState('unauthenticated');
      showToast('已安全登出系统');
    }
  };

  const handleApiError = (err) => {
    if (err.message === 'UNAUTHORIZED') {
      setStoredToken('');
      setAuthState('unauthenticated');
      setLoginError('登录凭据已失效，请重新登录');
      showToast('登录凭据已失效，请重新登录', 'error');
    } else {
      showToast(err.message || '操作失败', 'error');
    }
  };

  // 获取命名空间列表
  const fetchNamespaces = async (preferredNs = null) => {
    try {
      const data = await api.listNamespaces();
      const list = data.namespaces || [];
      setNamespaces(list);

      if (preferredNs && list.includes(preferredNs)) {
        setCurrentNamespace(preferredNs);
      } else if (!currentNamespace && list.length > 0) {
        setCurrentNamespace(list[0]);
      } else if (list.length === 0) {
        setCurrentNamespace('');
      }
    } catch (err) {
      handleApiError(err);
    }
  };

  // 获取当前命名空间统计数据与 Keys
  const fetchNamespaceData = async (ns = currentNamespace, prefix = searchPrefix) => {
    if (!ns) return;
    setLoading(true);
    try {
      const [statsData, keysData] = await Promise.all([
        api.getStats(ns),
        api.listKeys(ns, prefix),
      ]);
      setStats(statsData || { keys: 0, usedMB: 0, maxMB: 128 });
      setKeys(keysData.keys || []);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  // 认证成功后拉取数据
  useEffect(() => {
    if (authState === 'authenticated') {
      fetchNamespaces();
    }
  }, [authState]);

  useEffect(() => {
    if (authState === 'authenticated' && currentNamespace) {
      fetchNamespaceData(currentNamespace, searchPrefix);
      setSelectedKey(null);
      setKeyValue('');
    }
  }, [currentNamespace, authState]);

  // 查看 Key 详情
  const handleSelectKey = async (key) => {
    setSelectedKey(key);
    setLoadingKey(true);
    try {
      const val = await api.getKey(currentNamespace, key);
      setKeyValue(val);
      setInputKey(key);
      setInputValue(val);
    } catch (err) {
      if (err.message === 'NOT_FOUND') {
        showToast('该 Key 已过期或已被删除', 'error');
        fetchNamespaceData();
      } else {
        handleApiError(err);
      }
    } finally {
      setLoadingKey(false);
    }
  };

  // 写入或更新 Key
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!inputKey.trim()) {
      showToast('Key 键名不能为空', 'error');
      return;
    }
    try {
      await api.putKey(currentNamespace, inputKey.trim(), inputValue, inputTTL);
      showToast(`Key "${inputKey}" 保存成功`);
      fetchNamespaceData();
      if (selectedKey === inputKey.trim()) {
        setKeyValue(inputValue);
      }
    } catch (err) {
      handleApiError(err);
    }
  };

  // 快速计数自增
  const handleIncr = async (amount) => {
    if (!selectedKey) return;
    try {
      const res = await api.incrKey(currentNamespace, selectedKey, amount);
      setKeyValue(String(res.value));
      setInputValue(String(res.value));
      showToast(`数值更新为: ${res.value}`);
      fetchNamespaceData();
    } catch (err) {
      handleApiError(err);
    }
  };

  // 删除 Key
  const handleDeleteKey = async (key) => {
    if (!window.confirm(`确认删除键 "${key}" 吗？`)) return;
    try {
      await api.deleteKey(currentNamespace, key);
      showToast(`Key "${key}" 已删除`);
      if (selectedKey === key) {
        setSelectedKey(null);
        setKeyValue('');
      }
      fetchNamespaceData();
    } catch (err) {
      handleApiError(err);
    }
  };

  // 创建命名空间
  const handleCreateNamespace = async () => {
    const trimmed = newNamespace.trim();
    if (!trimmed) return;
    try {
      await api.createNamespace(trimmed);
      showToast(`命名空间 "${trimmed}" 创建成功`);
      setNewNamespace('');
      fetchNamespaces(trimmed);
    } catch (err) {
      handleApiError(err);
    }
  };

  // 删除命名空间
  const handleDeleteNamespace = async (ns) => {
    if (!window.confirm(`⚠️ 高危操作：确定删除命名空间 "${ns}" 及其所有数据吗？`)) return;
    try {
      await api.deleteNamespace(ns);
      showToast(`命名空间 "${ns}" 已删除`);
      if (currentNamespace === ns) {
        setCurrentNamespace('');
      }
      fetchNamespaces();
    } catch (err) {
      handleApiError(err);
    }
  };

  // 清空当前命名空间
  const handleClearNamespace = async () => {
    if (!window.confirm(`⚠️ 确定清空命名空间 "${currentNamespace}" 的全部数据吗？`)) return;
    try {
      await api.clearNamespace(currentNamespace);
      showToast(`命名空间 "${currentNamespace}" 已清空`);
      setSelectedKey(null);
      setKeyValue('');
      fetchNamespaceData();
    } catch (err) {
      handleApiError(err);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedJSON = useMemo(() => {
    if (!keyValue) return null;
    try {
      const parsed = JSON.parse(keyValue);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return null;
    }
  }, [keyValue]);

  const formatJSONInput = () => {
    try {
      const parsed = JSON.parse(inputValue);
      setInputValue(JSON.stringify(parsed, null, 2));
      showToast('JSON 已格式化');
    } catch {
      showToast('当前内容不是合法的 JSON 格式', 'error');
    }
  };

  // 1. 初始化检查状态界面
  if (authState === 'checking') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-xs">正在连接 LiuKV 服务...</p>
        </div>
      </div>
    );
  }

  // 2. 独立登录界面
  if (authState === 'unauthenticated') {
    return (
      <div className="relative flex min-h-screen w-screen items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 font-sans text-slate-900 dark:text-slate-100 transition-colors">
        {/* 登录页右上角主题切换按钮 */}
        <div className="absolute top-4 right-4">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm backdrop-blur hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="切换深浅主题"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
          </button>
        </div>

        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-8 shadow-xl dark:shadow-2xl backdrop-blur-md">
          {/* 装饰渐变光晕 */}
          <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-blue-500/10 dark:bg-blue-600/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-indigo-500/10 dark:bg-indigo-600/20 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            {/* Logo 与标题 */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-3">
                <Database className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                LiuKV Console
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                高性能内存 Key-Value 存储控制台
              </p>
            </div>

            {/* 登录表单 */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>安全 Token (AUTH_TOKEN)</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">仅存本地浏览器</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入服务配置的 Token"
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      if (loginError) setLoginError('');
                    }}
                    autoFocus
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/80 py-2.5 pl-9 pr-10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>正在校验...</span>
                  </>
                ) : (
                  <>
                    <span>验证并进入控制台</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-200 dark:border-slate-800/80 pt-4 text-center">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
                <Server className="h-3 w-3" />
                LiuKV v1.0.0 · Embedded Single Binary
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. 已认证主控制台界面
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 transition-colors">
      {/* 顶部浮动 Toast */}
      {toast.message && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm font-medium shadow-xl transition-all ${
            toast.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/90 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              : 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* 左侧边栏：Namespaces & 用户信息 */}
      <aside className="w-72 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Database className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                LiuKV
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Console
                </span>
              </h1>
            </div>
          </div>

          {/* 主题切换开关 */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={theme === 'dark' ? '切换为浅色模式' : '切换为深色模式'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>
        </div>

        {/* 新建 Namespace */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-transparent">
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="新建 Namespace..."
              value={newNamespace}
              onChange={(e) => setNewNamespace(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNamespace()}
              className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleCreateNamespace}
              className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Namespaces 列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>命名空间 ({namespaces.length})</span>
            <button onClick={() => fetchNamespaces()} className="hover:text-slate-900 dark:hover:text-white transition-colors" title="刷新列表">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
          {namespaces.map((ns) => (
            <div
              key={ns}
              onClick={() => setCurrentNamespace(ns)}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs font-medium transition-all ${
                currentNamespace === ns
                  ? 'bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Layers className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{ns}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteNamespace(ns);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 rounded transition-opacity"
                title="删除命名空间"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {namespaces.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">暂无命名空间</div>
          )}
        </div>

        {/* 底部用户认证信息 & 登出入口 */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {serverRequiresAuth ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">Token 授权连接</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">安全会话已建立</span>
                  </div>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">开放模式</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">未配置 AUTH_TOKEN</span>
                  </div>
                </>
              )}
            </div>

            {serverRequiresAuth && (
              <button
                onClick={handleLogout}
                title="退出登录"
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>退出</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* 主界面区 */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
        {currentNamespace ? (
          <>
            {/* 顶部指标监控条 */}
            <header className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 flex items-center justify-between flex-wrap gap-4 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{currentNamespace}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">|</span>
                </div>
                {/* 统计指标 */}
                <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                    <span>Keys:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{stats.keys || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                    <span>内存:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {stats.usedMB ? stats.usedMB.toFixed(3) : '0.000'} MB / {stats.maxMB || 128} MB
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchNamespaceData()}
                  className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-transparent"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
                <button
                  onClick={handleClearNamespace}
                  className="px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/20 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <FolderMinus className="h-3.5 w-3.5" />
                  清空空间
                </button>
              </div>
            </header>

            {/* 内容主体双栏 */}
            <div className="flex-1 flex min-h-0">
              {/* 中间栏：Key 检索与列表 */}
              <div className="w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900/20">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800/80">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="按前缀搜索 Key..."
                      value={searchPrefix}
                      onChange={(e) => setSearchPrefix(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchNamespaceData(currentNamespace, searchPrefix)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {keys.map((k) => (
                    <div
                      key={k}
                      onClick={() => handleSelectKey(k)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-all ${
                        selectedKey === k
                          ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="truncate flex-1 pr-2">{k}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteKey(k);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded"
                        title="删除键"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {keys.length === 0 && (
                    <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-500">
                      {searchPrefix ? '未匹配到任何 Key' : '当前空间暂无数据'}
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧主面板：详情展示与写入表单 */}
              <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
                {selectedKey && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">{selectedKey}</span>
                        {formattedJSON && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            JSON
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800/80 p-0.5 border border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => handleIncr(-1 * incrStep)}
                            className="px-2 py-0.5 text-xs hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-mono"
                            title={`-${incrStep}`}
                          >
                            -{incrStep}
                          </button>
                          <button
                            onClick={() => handleIncr(incrStep)}
                            className="px-2 py-0.5 text-xs hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 rounded font-mono"
                            title={`+${incrStep}`}
                          >
                            +{incrStep}
                          </button>
                        </div>

                        <button
                          onClick={() => handleCopy(keyValue)}
                          className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-transparent"
                        >
                          {copied ? <Check className="h-3 w-3 text-emerald-500 dark:text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copied ? '已复制' : '复制 Value'}
                        </button>
                      </div>
                    </div>

                    <pre className="p-3 bg-slate-900 text-slate-100 dark:bg-slate-950 dark:text-slate-300 rounded-lg text-xs font-mono overflow-x-auto max-h-60 whitespace-pre-wrap word-break-all border border-slate-800/60">
                      {loadingKey ? '加载中...' : formattedJSON || keyValue || '(空字符串)'}
                    </pre>
                  </div>
                )}

                <form onSubmit={handleSave} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5 space-y-4 shadow-sm dark:shadow-none">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                      {selectedKey ? '编辑 / 覆盖数据' : '写入新键值'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={formatJSONInput}
                        className="text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
                      >
                        <Sparkles className="h-3 w-3" />
                        JSON 格式化校验
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400">Key 键名</label>
                      <input
                        type="text"
                        placeholder="user_1001"
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        TTL (秒, 0 为永不过期)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={inputTTL}
                        onChange={(e) => setInputTTL(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400">Value 内容</label>
                    <textarea
                      rows={6}
                      placeholder='{"name": "LiuKV", "enabled": true}'
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-y"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    {selectedKey && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedKey(null);
                          setInputKey('');
                          setInputValue('');
                          setInputTTL(0);
                        }}
                        className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-transparent"
                      >
                        重置表单
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                    >
                      保存提交
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500">
            <Layers className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">欢迎使用 LiuKV 管理后台</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
              请在左侧侧边栏选择一个 Namespace，或输入名称点击 “+” 创建新空间以开始操作。
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
