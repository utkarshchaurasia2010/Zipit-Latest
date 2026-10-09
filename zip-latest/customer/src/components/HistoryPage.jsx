import React from 'react';
import './HistoryPage.css';
import { PackageCheck } from 'lucide-react';

const ORDERS = [
  { id: 'OD12345678', date: 'Yesterday, 8:45 PM', status: 'Delivered', amount: 345, items: 'Amul Taaza Milk, Hybrid Tomato + 3 more' },
  { id: 'OD98765432', date: '14 Jun, 11:30 AM', status: 'Delivered', amount: 890, items: 'Britannia Bread, Fresh Potato + 8 more' },
];

const HistoryPage = () => {
  return (
    <div className="history-page">
      <header className="page-header">
        <h2>Order History</h2>
      </header>
      <div className="orders-list">
        {ORDERS.map(order => (
          <div key={order.id} className="order-card">
            <div className="order-card-header">
              <div className="order-status">
                <PackageCheck size={16} color="var(--color-success)" />
                <span className="status-text">{order.status}</span>
              </div>
              <span className="order-date">{order.date}</span>
            </div>
            <div className="order-details">
              <p className="order-items">{order.items}</p>
              <h4 className="order-amount">₹{order.amount}</h4>
            </div>
            <div className="order-footer">
              <button className="reorder-btn">Reorder</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default HistoryPage;
