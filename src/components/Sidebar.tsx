'use client';

import { useState } from 'react';
import Link from 'next/link';

interface SidebarCategory {
    name: string;
    items?: string[];
    isExpanded?: boolean;
}

const categories: SidebarCategory[] = [
    {
        name: 'Popular',
        items: ['Bingo Card Generator', '1-75 Bingo', '1-90 Bingo', 'Virtual Bingo', 'Online Escape Rooms', 'Help & FAQs', 'Find My Order'],
        isExpanded: true,
    },
    { name: 'Numbers' },
    { name: 'Occasions' },
    { name: 'Kids' },
    { name: 'Movies' },
    { name: 'Funny' },
    { name: 'Human Bingo' },
    { name: 'Music' },
    { name: 'School' },
    { name: 'Sport' },
    { name: 'Templates' },
    { name: 'Travel' },
    { name: 'TV' },
];

export default function Sidebar() {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(['Popular'])
    );

    const toggleCategory = (name: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    return (
        <aside className="sidebar">
            {categories.map((category) => (
                <div key={category.name} className="category">
                    <button
                        className={`category-header ${expandedCategories.has(category.name) ? 'expanded' : ''}`}
                        onClick={() => toggleCategory(category.name)}
                    >
                        <span>{category.name}</span>
                        <span className="chevron">›</span>
                    </button>

                    {category.items && expandedCategories.has(category.name) && (
                        <div className="category-items">
                            {category.items.map((item) => (
                                <Link
                                    key={item}
                                    href={item === 'Virtual Bingo' ? '/play' : item === 'Find My Order' ? '/admin' : '/'}
                                    className={`category-item ${item.includes('Bingo') ? 'highlight' : ''}`}
                                >
                                    {item}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            <style jsx>{`
        .sidebar {
          width: var(--sidebar-width);
          background: var(--color-bg-secondary);
          min-height: calc(100vh - 60px);
          padding: 16px 0;
          box-shadow: var(--shadow-sm);
          overflow-y: auto;
        }

        .category {
          border-bottom: 1px solid #eee;
        }

        .category:last-child {
          border-bottom: none;
        }

        .category-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--color-sidebar);
          color: var(--color-sidebar-text);
          border: none;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          font-family: inherit;
          text-align: left;
          transition: background var(--transition-fast);
        }

        .category-header:hover {
          background: var(--color-sidebar-hover);
        }

        .chevron {
          font-size: 1.2rem;
          transition: transform var(--transition-fast);
        }

        .category-header.expanded .chevron {
          transform: rotate(90deg);
        }

        .category-items {
          background: var(--color-bg-secondary);
          padding: 8px 0;
        }

        .category-item {
          display: block;
          padding: 8px 16px 8px 24px;
          color: var(--color-text-primary);
          font-size: 0.9rem;
          text-decoration: none;
          transition: all var(--transition-fast);
        }

        .category-item:hover {
          background: var(--color-bg-primary);
          color: var(--color-accent-secondary);
          text-decoration: none;
        }

        .category-item.highlight {
          color: var(--color-accent-tertiary);
        }

        @media (max-width: 900px) {
          .sidebar {
            display: none;
          }
        }
      `}</style>
        </aside>
    );
}
