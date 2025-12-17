'use client';

import Link from 'next/link';
import { ConnectKitButton } from 'connectkit';

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="navbar-content">
                <div className="navbar-brand">
                    <Link href="/" className="logo">
                        <span className="logo-my">MY FREE</span>
                        <span className="logo-bingo">Bingo</span>
                        <span className="logo-cards">CARDS</span>
                        <span className="logo-star">★</span>
                    </Link>
                </div>

                <div className="navbar-links">
                    <Link href="/" className="nav-link">Bingo Card Generator</Link>
                    <Link href="/" className="nav-link">Number Bingo</Link>
                    <Link href="/play" className="nav-link">Virtual Bingo</Link>
                    <Link href="/admin" className="nav-link">Find My Order</Link>
                </div>

                <div className="navbar-actions">
                    <ConnectKitButton />
                </div>
            </div>

            <style jsx>{`
        .navbar {
          background: var(--color-navbar);
          padding: 0 20px;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: var(--shadow-md);
        }

        .navbar-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 60px;
          gap: 20px;
        }

        .navbar-brand {
          flex-shrink: 0;
        }

        .logo {
          display: flex;
          align-items: baseline;
          gap: 2px;
          text-decoration: none;
          font-weight: 700;
        }

        .logo-my {
          color: #90caf9;
          font-size: 0.7rem;
          letter-spacing: 0.5px;
        }

        .logo-bingo {
          color: #ff6b6b;
          font-size: 1.5rem;
          font-style: italic;
          font-weight: 800;
        }

        .logo-cards {
          color: #90caf9;
          font-size: 0.7rem;
          letter-spacing: 0.5px;
        }

        .logo-star {
          color: #ffd700;
          font-size: 1rem;
          margin-left: 4px;
        }

        .navbar-links {
          display: flex;
          gap: 8px;
        }

        .nav-link {
          color: var(--color-navbar-text);
          padding: 8px 16px;
          border-radius: var(--radius-md);
          font-size: 0.95rem;
          font-weight: 500;
          text-decoration: none;
          transition: background var(--transition-fast);
        }

        .nav-link:hover {
          background: rgba(255, 255, 255, 0.15);
          text-decoration: none;
        }

        .navbar-actions {
          flex-shrink: 0;
        }

        @media (max-width: 900px) {
          .navbar-links {
            display: none;
          }

          .navbar-content {
            justify-content: space-between;
          }
        }
      `}</style>
        </nav>
    );
}
