import React, { useState, useEffect } from 'react';
import './LegalPoliciesPage.css';
import { ChevronLeft, ShieldCheck, Lock, RotateCcw, Truck, FileText, Mail, AlertCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const POLICIES = {
  terms: {
    id: 'terms',
    label: 'Terms of Service',
    icon: <FileText size={17} />,
    title: 'Terms of Service & User Agreement',
    effectiveDate: 'Last Updated: October 2026',
    sections: [
      {
        heading: '1. Platform Use & Eligibility',
        text: 'By using the Zipit application and services, you confirm that you are at least 18 years old or are using the app under the supervision of a parent or guardian. You agree to provide true, accurate, and current information when creating an account or placing orders.'
      },
      {
        heading: '2. 10-Minute Delivery & Estimated Timelines',
        text: 'Delivery durations displayed on the platform (e.g., 9–15 mins) are operational estimates calculated based on store proximity, inventory readiness, and road traffic. While we maintain a strict fast-dispatch commitment, delays due to torrential rains, extreme weather, road closures, or high surges may occur. Our delivery partner safety is of paramount importance.'
      },
      {
        heading: '3. Pricing, Product Availability & Billing',
        text: 'All prices quoted on the platform are in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise. In rare situations where an item becomes out-of-stock after order confirmation, the amount will be refunded immediately to your original payment method or wallet.'
      },
      {
        heading: '4. Cash on Delivery (COD) & Payment Integrity',
        text: 'We accept UPI, Debit/Credit Cards, Net Banking, and Cash on Delivery (COD). Zipit reserves the right to disable Cash on Delivery for accounts that demonstrate repeated delivery refusals, fraudulent claims, or unreasonable order cancellations.'
      },
      {
        heading: '5. Limitation of Liability',
        text: 'Zipit acts as an instant retail commerce platform. We source products from certified FMCG distributors and local producers. We are not liable for manufacturer packaging defects or product alterations done by third-party brands beyond our verifiable storage conditions.'
      }
    ]
  },
  privacy: {
    id: 'privacy',
    label: 'Privacy Policy',
    icon: <Lock size={17} />,
    title: 'Privacy & Data Protection Policy',
    effectiveDate: 'Last Updated: October 2026',
    sections: [
      {
        heading: '1. Information We Collect',
        text: 'To fulfill fast local deliveries, we collect: (a) Phone number and name for verification and contact, (b) Delivery addresses and precise GPS coordinates to guide our delivery riders, and (c) Order transaction history to facilitate reorders and dispute resolutions.'
      },
      {
        heading: '2. How We Use Your Data',
        text: 'Your personal information is strictly used to process, dispatch, and track orders, communicate OTP verifications via WhatsApp or SMS, and provide customer support. We do not sell, rent, or trade your personal data to any marketing agencies or external data brokers.'
      },
      {
        heading: '3. Data Security & Storage',
        text: 'We utilize enterprise-grade encrypted databases (PostgreSQL/Supabase) with strict Row-Level Security (RLS) policies. Payment transactions are processed directly by certified RBI-compliant payment aggregators; Zipit never stores your bank account passwords, CVVs, or UPI PINs.'
      },
      {
        heading: '4. User Rights & Account Deletion',
        text: 'You have full rights to request correction of your profile data or complete deletion of your account and saved addresses. You may contact our support desk at zipitrural@gmail.com to request permanent data removal.'
      }
    ]
  },
  refund: {
    id: 'refund',
    label: 'Refund & Returns',
    icon: <RotateCcw size={17} />,
    title: 'Cancellations, Returns & Refund Policy',
    effectiveDate: 'Last Updated: October 2026',
    sections: [
      {
        heading: '1. Order Cancellation Window',
        text: 'You can cancel an order free of charge within 60 seconds of placement or before our fulfillment hub begins packing. Once an order is marked as "Out for Delivery", cancellation is not permitted as items are already in transit.'
      },
      {
        heading: '2. Perishable Items Return Rules',
        text: 'Perishable goods including fresh milk, dairy (paneer, curd), bread, fruits, and vegetables are non-returnable once accepted at delivery, except in cases where the item received is expired, spoiled, sour, or physically damaged.'
      },
      {
        heading: '3. Reporting Damaged or Incorrect Items',
        text: 'If you receive damaged, expired, or incorrect products, please report the issue via our in-app support or WhatsApp bot within 2 hours of delivery. Providing a clear photo of the item and its package allows us to process instant replacements or refunds.'
      },
      {
        heading: '4. Refund Processing Time',
        text: 'Approved refunds are initiated immediately. For UPI and wallet transactions, funds typically reflect within 2 to 24 hours. For Debit/Credit cards, bank processing may take 3 to 5 business days according to standard banking clearing cycles.'
      }
    ]
  },
  shipping: {
    id: 'shipping',
    label: 'Shipping & Delivery',
    icon: <Truck size={17} />,
    title: 'Shipping & Delivery Policy',
    effectiveDate: 'Last Updated: October 2026',
    sections: [
      {
        heading: '1. Serviceable Locations & Hubs',
        text: 'Zipit operates through hyperlocal fulfillment micro-warehouses (dark stores) catering to designated pin codes and village perimeters. Deliveries can only be dispatched to addresses within our designated active delivery zones.'
      },
      {
        heading: '2. Delivery Charges & Free Delivery Thresholds',
        text: 'Orders may be subject to a nominal delivery charge or small cart fee based on distance and cart value. Any applicable delivery charges are calculated transparently and shown on the checkout screen before payment confirmation.'
      },
      {
        heading: '3. Accurate GPS Pinning & Rider Safety',
        text: 'Customers are requested to ensure their delivery pin and landmark notes are accurate. Our delivery riders are instructed to follow safe speed protocols; delivery estimates are generated safely without putting riders under dangerous driving pressure.'
      },
      {
        heading: '4. Contactless & Doorstep Delivery',
        text: 'Our riders offer doorstep delivery. If you request the rider to leave the order with a guard, neighbor, or at your doorstep, Zipit is not liable for theft or damage occurring after successful drop-off notification.'
      }
    ]
  }
};

const LegalPoliciesPage = ({ navigate, onBack }) => {
  const location = useLocation();
  const initialTab = location.state?.policy || 'terms';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (location.state?.policy && POLICIES[location.state.policy]) {
      setActiveTab(location.state.policy);
    }
  }, [location.state]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigate) {
      navigate(-1);
    }
  };

  const currentPolicy = POLICIES[activeTab] || POLICIES.terms;

  return (
    <div className="legal-policies-page">
      <header className="legal-header">
        <button className="back-btn" onClick={handleBack} aria-label="Go back">
          <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
        </button>
        <h1>Legal & Policies</h1>
      </header>

      {/* Policy Tabs */}
      <div className="policy-tabs-bar">
        {Object.values(POLICIES).map((policy) => (
          <button
            key={policy.id}
            className={`policy-tab-chip ${activeTab === policy.id ? 'active' : ''}`}
            onClick={() => setActiveTab(policy.id)}
          >
            {policy.icon}
            <span>{policy.label}</span>
          </button>
        ))}
      </div>

      <div className="legal-content-container">
        <div className="policy-intro-card">
          <div className="policy-badge-row">
            <span className="policy-verified-badge">
              <ShieldCheck size={14} /> Official Policy
            </span>
            <span className="policy-date">{currentPolicy.effectiveDate}</span>
          </div>
          <h2>{currentPolicy.title}</h2>
          <p>
            Please read these terms carefully. They define our service commitments, user safeguards, and operational policies for Zipit customers.
          </p>
        </div>

        {currentPolicy.sections.map((sec, idx) => (
          <div key={idx} className="policy-section-card">
            <h3>{sec.heading}</h3>
            <p>{sec.text}</p>
          </div>
        ))}

        {/* Consumer Grievance & Help Desk (Mandatory for Indian E-Commerce) */}
        <div className="legal-grievance-card">
          <div className="grievance-header">
            <AlertCircle size={20} color="var(--color-primary)" />
            <h4>Grievance Redressal & Support</h4>
          </div>
          <p>
            In accordance with the Information Technology Act & Consumer Protection (E-Commerce) Rules, inquiries and disputes can be sent to our designated officer:
          </p>
          <div className="grievance-contact">
            <div className="contact-row">
              <Mail size={15} color="var(--color-text-light)" />
              <a href="mailto:zipitrural@gmail.com">zipitrural@gmail.com</a>
            </div>
            <div className="contact-row response-time">
              <span>Resolution SLA: Within 48 business hours</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalPoliciesPage;
