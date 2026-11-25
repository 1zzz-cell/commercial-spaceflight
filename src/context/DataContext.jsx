import { createContext, useContext, useState, useEffect } from 'react';
import { loadAllData } from '../utils/dataLoader';
import Icon from '../components/Icon';

const DataContext = createContext(null);

const LOADING_STEPS = [
  '连接数据源…',
  '加载火箭型号数据…',
  '加载卫星星座数据…',
  '加载产业链数据…',
  '加载融资数据…',
  '加载政策数据…',
  '数据就绪',
];

function LoadingScreen() {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f5ff 0%, #f8fafc 50%, #f0f9ff 100%)',
      gap: '24px',
    }}>
      <div
        className="ds-boot-spinner"
        style={{
          width: 56,
          height: 56,
          border: '3px solid #dbeafe',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        fontSize: '0.9rem',
        color: '#475569',
        fontWeight: 500,
        letterSpacing: '0.05em',
      }}>
        {LOADING_STEPS[stepIdx]}
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f8fafc',
      gap: '16px',
    }}>
      <div style={{ color: '#f59e0b' }} aria-hidden="true">
        <Icon name="alert" size={40} strokeWidth={1.6} />
      </div>
      <div style={{ fontSize: '1rem', color: '#475569', fontWeight: 600 }}>
        数据加载失败
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 400, textAlign: 'center' }}>
        {message}
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: '8px 24px',
          minHeight: 44,
          borderRadius: 8,
          border: '1px solid #0a63b8',
          background: '#0a63b8',
          color: '#fff',
          fontSize: '0.85rem',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        重新加载
      </button>
    </div>
  );
}

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    loadAllData()
      .then(setData)
      .catch((err) => setError(err.message || '未知错误'));
  };

  useEffect(() => { load(); }, []);

  if (error) return <ErrorScreen message={error} onRetry={load} />;
  if (!data) return <LoadingScreen />;

  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
