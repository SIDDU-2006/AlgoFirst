"use client";

import React from 'react';
import { Search, User } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeIn } from '@/lib/animations';

export default function TopNav() {
  return (
    <header className="w-full border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-md text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
              <Search size={16} />
            </button>
            <motion.div className="hidden sm:block" initial="hidden" animate="show" variants={fadeIn}>
              <motion.input
                aria-label="Search problems"
                placeholder="Search problems, tags, #..."
                className="w-72 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                whileFocus={{ scale: 1.01 }}
              />
            </motion.div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="hidden sm:flex items-center gap-2">
              <Link href="/problem-list" className="text-sm text-zinc-300 hover:text-zinc-100">Problems</Link>
              <Link href="/progress" className="text-sm text-zinc-300 hover:text-zinc-100">Progress</Link>
              <Link href="/student-plan" className="text-sm text-zinc-300 hover:text-zinc-100">Plan</Link>
            </nav>

            <button className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors">
              <User size={16} />
              <span className="hidden sm:inline">Account</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
