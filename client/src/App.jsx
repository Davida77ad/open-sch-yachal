import { useState } from 'react';
import RegistrationForm from './components/RegistrationForm';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [view, setView] = useState('register');

  return (
    <div className="app-shell">
      <section className="panel about-section">
        <h2>About Open School of Ministry</h2>
        <p>Our local church, Saints Community Church, runs an internal leadership training school called Livingword Ministerial Academy (L.M.A), which is open ONLY to leaders of our local church. However, at different times in the past, we have organized "Open Classes" to our church members who were/are not otherwise qualified for the school and non-church members.</p>
        <p>It is called "Open School of Ministry", which firstly held in July 2015, followed by three subsequent instalments, with the latest holding in July 2024.</p>
        <p>The fifth edition will be held from <strong>Monday, July 6th – Wednesday, July 8th, 2026</strong>, with arrival on <strong>Sunday, July 5th, 2026</strong>.</p>
      </section>

      <header className="topbar">
        <div>
          <p className="eyebrow">Ghana Registration Portal</p>
        </div>
        <div className="nav-buttons">
          <button type="button" className={view === 'register' ? 'active' : ''} onClick={() => setView('register')}>
            Register
          </button>
          <button type="button" className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>
            Admin
          </button>
        </div>
      </header>

      <main>
        {view === 'register' ? (
          <>

            <RegistrationForm />
          </>
        ) : (
          <AdminDashboard />
        )}
      </main>
    </div>
  );
}
