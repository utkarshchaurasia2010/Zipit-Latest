import React from 'react';
import './TermsPage.css';
import { ChevronLeft, Shield, Clock, CreditCard, RefreshCw, MapPin, Lock, Scale } from 'lucide-react';

const TermsPage = ({ navigate, onBack }) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigate) {
      navigate(-1);
    }
  };

  const termsData = [
    {
      number: "1",
      icon: <Shield size={18} color="var(--color-primary)" />,
      title: "Acceptance of Terms",
      content:
        "By accessing, downloading, or using the Zipit mobile application and services, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions. If you do not agree, please discontinue using the application."
    },
    {
      number: "2",
      icon: <Clock size={18} color="var(--color-primary)" />,
      title: "10-Minute Delivery Guarantee & Estimates",
      content:
        "Our '10-minute delivery' is an estimated timeframe based on optimal traffic, weather, and store-capacity conditions. While we strive to meet this SLA on every order, Zipit is not liable for minor delays caused by severe weather, road blockages, or unexpected demand surges. Our rider safety is paramount."
    },
    {
      number: "3",
      icon: <CreditCard size={18} color="var(--color-primary)" />,
      title: "Pricing, Payments & COD",
      content:
        "All prices listed on the app are inclusive of applicable GST unless stated otherwise. Cash on Delivery (COD) and online payments (UPI, Cards, NetBanking) are accepted. Zipit reserves the right to suspend COD privileges for accounts with repeated order rejections or fraudulent activity."
    },
    {
      number: "4",
      icon: <RefreshCw size={18} color="var(--color-primary)" />,
      title: "Cancellations, Returns & Refunds",
      content:
        "Orders can be cancelled free of charge within 60 seconds of placement or before a delivery partner is assigned. For damaged, expired, or incorrect items received, users must raise a complaint within 2 hours of delivery with photographic evidence. Approved refunds will be credited within 3-5 business days."
    },
    {
      number: "5",
      icon: <MapPin size={18} color="var(--color-primary)" />,
      title: "Delivery Accuracy & Pinning",
      content:
        "Users are responsible for providing precise GPS coordinates and accurate address details. Zipit is not responsible for failed deliveries resulting from incorrect map pins, unreachable contact numbers, or restricted premises access."
    },
    {
      number: "6",
      icon: <Lock size={18} color="var(--color-primary)" />,
      title: "User Privacy & Data Protection",
      content:
        "We respect your privacy. User location, order history, and contact information are strictly processed in accordance with our Privacy Policy to fulfill orders and improve service delivery. We do not sell your personal data to third parties."
    },
    {
      number: "7",
      icon: <Scale size={18} color="var(--color-primary)" />,
      title: "Governing Law & Jurisdiction",
      content:
        "These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the courts located in Gurugram, Haryana."
    }
  ];

  return (
    <div className="terms-page">
      <header className="terms-header">
        <button className="back-btn" onClick={handleBack} aria-label="Go back">
          <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
        </button>
        <h1>Terms & Conditions</h1>
      </header>

      <div className="terms-content">
        <div className="terms-intro-card">
          <h2>Zipit Consumer Agreement</h2>
          <div className="effective-date">Effective Date: July 28, 2026</div>
          <p>
            Welcome to Zipit! These Terms and Conditions govern your use of our instant grocery delivery platform and mobile application. Please read them carefully before placing an order.
          </p>
        </div>

        {termsData.map((item) => (
          <div key={item.number} className="terms-section-card">
            <h3>
              <span className="section-number">{item.number}</span>
              {item.title}
            </h3>
            <p>{item.content}</p>
          </div>
        ))}

        <div className="terms-footer-card">
          <p>Questions or legal inquiries regarding our Terms?</p>
          <a href="mailto:zipitrural@gmail.com">zipitrural@gmail.com</a>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
