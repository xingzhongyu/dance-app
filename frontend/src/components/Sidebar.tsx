"use client";
import { UploadCloud, Database, Globe } from 'lucide-react';
import styles from '../styles/Sidebar.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname(); // 当在首页时, pathname 的值是 "/"
  const { user } = useAuth();

  const navItems = [
    { href: '/atlas', label: 'Atlas Datasets', icon: <Globe size={20} /> },
    // 1. 修改 href, 避免使用特殊的根路径 "/"
    { href: '/', label: 'Dataset Upload', icon: <UploadCloud size={20} /> },
    { href: '/datasets', label: 'My Datasets', icon: <Database size={20} /> },
  ];

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {user && (
           <ul>
           {navItems.map(item => {
             // 2. 修改高亮逻辑
             // 如果 item 的 href 是 /index, 并且当前路径是 /, 那么也应该高亮
             const isActive = (item.href === '/index' && pathname === '/') || pathname === item.href;

             return (
               <li key={item.href}>
                 <Link 
                   href={item.href} 
                   className={isActive ? styles.active : ''}
                 >
                   {item.icon}
                   <span>{item.label}</span>
                 </Link>
               </li>
             );
           })}
         </ul>
        )}
      </nav>
    </aside>
  );
}