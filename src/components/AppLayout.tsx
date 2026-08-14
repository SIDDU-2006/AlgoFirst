'use client';

import React from 'react';
import CollapsibleSidebar from './layout/CollapsibleSidebar';
import TopNav from './TopNav';

interface AppLayoutProps {
	children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
	return (
		<div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
			<TopNav />
			<div className="flex flex-1 min-h-0">
				<CollapsibleSidebar />
				<main className="flex-1 min-w-0 overflow-auto">{children}</main>
			</div>
		</div>
	);
}
