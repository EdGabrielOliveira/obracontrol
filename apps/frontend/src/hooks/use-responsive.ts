import { useEffect, useState } from "react";

interface ResponsiveState {
	isMobile: boolean;
	isCollapsed: boolean;
}

export function useResponsive(): ResponsiveState {
	const [isMobile, setIsMobile] = useState(false);
	const [isCollapsed, setIsCollapsed] = useState(false);

	useEffect(() => {
		const mobileQuery = window.matchMedia("(max-width: 767px)");
		const tabletQuery = window.matchMedia(
			"(min-width: 768px) and (max-width: 1023px)",
		);

		setIsMobile(mobileQuery.matches);
		setIsCollapsed(tabletQuery.matches);

		const handleMobileChange = (e: MediaQueryListEvent) =>
			setIsMobile(e.matches);
		const handleTabletChange = (e: MediaQueryListEvent) =>
			setIsCollapsed(e.matches);

		mobileQuery.addEventListener("change", handleMobileChange);
		tabletQuery.addEventListener("change", handleTabletChange);

		return () => {
			mobileQuery.removeEventListener("change", handleMobileChange);
			tabletQuery.removeEventListener("change", handleTabletChange);
		};
	}, []);

	return { isMobile, isCollapsed };
}
