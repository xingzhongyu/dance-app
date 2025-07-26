"use client";
import { UploadCloud, Database, Globe } from 'lucide-react';
import styles from '../styles/Sidebar.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  // Define navigation items array for easy management
  const navItems = [
    { href: '/atlas', label: 'Atlas Datasets', icon: <Globe size={20} /> },
    { href: '/', label: 'Dataset Upload', icon: <UploadCloud size={20} /> },
    { href: '/datasets', label: 'My Datasets', icon: <Database size={20} /> },
  ];
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {/* Only show these nav items after user login */}
        {user && (
           <ul>
           {navItems.map(item => (
             <li key={item.href}>
               <Link 
                 href={item.href} 
                 // Dynamically set active class
                 className={pathname === item.href ? styles.active : ''}
               >
                 {item.icon}
                 <span>{item.label}</span>
               </Link>
             </li>
           ))}
         </ul>
        )}
      </nav>
    </aside>
  );
}