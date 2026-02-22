import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../api';
import { AdminUser } from '../types';
import './AdminPanel.css';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get<AdminUser[]>('/admin/users');
        setUsers(response.data);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setMessage(
            err.response?.status === 403
              ? 'Доступ запрещён. Недостаточно прав.'
              : 'Ошибка загрузки пользователей'
          );
        } else {
          setMessage('Ошибка загрузки пользователей');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      setMessage(`Роль пользователя изменена на "${newRole}"`);
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.detail || 'Ошибка изменения роли');
      } else {
        setMessage('Ошибка изменения роли');
      }
    }
  };

  if (loading) {
    return <div className="admin-loading">Загрузка пользователей...</div>;
  }

  return (
    <div className="admin-panel">
      <h2>Управление пользователями</h2>
      <p className="admin-desc">
        Список всех пользователей системы. Изменение ролей доступно только администратору.
      </p>

      {message && (
        <div className={`admin-message ${message.startsWith('Ошибка') || message.startsWith('Доступ') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Имя</th>
              <th>Email</th>
              <th>Username</th>
              <th>Роль</th>
              <th>Дата регистрации</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.username}</td>
                <td>
                  <span className={`role-badge role-${user.role}`}>{user.role}</span>
                </td>
                <td>{new Date(user.created_at).toLocaleString('ru-RU')}</td>
                <td>
                  <select
                    className="role-select"
                    value={user.role}
                    onChange={e => handleRoleChange(user.id, e.target.value)}
                  >
                    <option value="free_user">free_user</option>
                    <option value="pro_user">pro_user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="admin-total">Всего пользователей: {users.length}</p>
    </div>
  );
};

export default AdminPanel;
