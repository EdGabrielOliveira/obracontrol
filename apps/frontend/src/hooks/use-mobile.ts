import { useEffect, useState } from "react";

export function useBreakpoint() {
	const [isMobile, setIsMobile] = useState(false);
	const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const mobileQuery = window.matchMedia("(max-width: 767px)");
		const tabletQuery = window.matchMedia("(max-width: 1279px)");

		const updateMatches = () => {
			setIsMobile(mobileQuery.matches);
			setIsMobileOrTablet(tabletQuery.matches);
		};

		updateMatches();

		mobileQuery.addEventListener("change", updateMatches);
		tabletQuery.addEventListener("change", updateMatches);

		return () => {
			mobileQuery.removeEventListener("change", updateMatches);
			tabletQuery.removeEventListener("change", updateMatches);
		};
	}, []);

	return { isMobile, isMobileOrTablet };
}
