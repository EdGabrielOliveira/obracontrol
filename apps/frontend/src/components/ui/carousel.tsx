import { ArrowLeft, ArrowRight } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CarouselApi = {
	scrollPrev: () => void;
	scrollNext: () => void;
	canScrollPrev: () => boolean;
	canScrollNext: () => boolean;
};

type CarouselOptions = Record<string, unknown>;
type CarouselPlugin = unknown[];

type CarouselProps = {
	opts?: CarouselOptions;
	plugins?: CarouselPlugin;
	orientation?: "horizontal" | "vertical";
	setApi?: (api: CarouselApi | null) => void;
};

type CarouselContextProps = {
	carouselRef: React.RefObject<HTMLDivElement | null>;
	api: CarouselApi;
	scrollPrev: () => void;
	scrollNext: () => void;
	canScrollPrev: boolean;
	canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
	const context = React.useContext(CarouselContext);

	if (!context) {
		throw new Error("useCarousel must be used within a <Carousel />");
	}

	return context;
}

function Carousel({
	orientation = "horizontal",
	opts,
	setApi,
	plugins,
	className,
	children,
	...props
}: React.ComponentProps<"div"> & CarouselProps) {
	const carouselRef = React.useRef<HTMLDivElement>(null);

	const api = React.useMemo<CarouselApi>(() => {
		const scrollBy = (direction: 1 | -1) => {
			if (!carouselRef.current) return;
			const delta = direction * (orientation === "horizontal" ? 320 : 240);
			carouselRef.current.scrollBy({
				left: orientation === "horizontal" ? delta : 0,
				top: orientation === "vertical" ? delta : 0,
				behavior: "smooth",
			});
		};

		return {
			scrollPrev: () => scrollBy(-1),
			scrollNext: () => scrollBy(1),
			canScrollPrev: () =>
				!!carouselRef.current && carouselRef.current.scrollLeft > 0,
			canScrollNext: () => {
				if (!carouselRef.current) return false;
				return (
					carouselRef.current.scrollLeft + carouselRef.current.clientWidth <
					carouselRef.current.scrollWidth - 1
				);
			},
		};
	}, [orientation]);

	React.useEffect(() => {
		setApi?.(api);
		return () => setApi?.(null);
	}, [api, setApi]);

	return (
		<CarouselContext.Provider
			value={{
				carouselRef,
				api,
				opts,
				plugins,
				orientation,
				setApi,
				scrollPrev: api.scrollPrev,
				scrollNext: api.scrollNext,
				canScrollPrev: api.canScrollPrev(),
				canScrollNext: api.canScrollNext(),
			}}
		>
			<section
				className={cn("relative", className)}
				data-slot="carousel"
				{...props}
			>
				{children}
			</section>
		</CarouselContext.Provider>
	);
}

function CarouselContent({ className, ...props }: React.ComponentProps<"div">) {
	const { carouselRef, orientation } = useCarousel();

	return (
		<div
			ref={carouselRef}
			className="overflow-hidden"
			data-slot="carousel-content"
		>
			<div
				className={cn(
					"flex",
					orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
	const { orientation } = useCarousel();

	return (
		<div
			data-slot="carousel-item"
			className={cn(
				"min-w-0 shrink-0 grow-0 basis-full",
				orientation === "horizontal" ? "pl-4" : "pt-4",
				className,
			)}
			{...props}
		/>
	);
}

function CarouselPrevious({
	className,
	variant = "outline",
	size = "icon",
	...props
}: React.ComponentProps<typeof Button>) {
	const { orientation, scrollPrev, canScrollPrev } = useCarousel();

	return (
		<Button
			data-slot="carousel-previous"
			variant={variant}
			size={size}
			className={cn(
				"absolute size-8 rounded-full",
				orientation === "horizontal"
					? "top-1/2 -left-12 -translate-y-1/2"
					: "-top-12 left-1/2 -translate-x-1/2 rotate-90",
				className,
			)}
			disabled={!canScrollPrev}
			onClick={scrollPrev}
			{...props}
		>
			<ArrowLeft />
			<span className="sr-only">Previous slide</span>
		</Button>
	);
}

function CarouselNext({
	className,
	variant = "outline",
	size = "icon",
	...props
}: React.ComponentProps<typeof Button>) {
	const { orientation, scrollNext, canScrollNext } = useCarousel();

	return (
		<Button
			data-slot="carousel-next"
			variant={variant}
			size={size}
			className={cn(
				"absolute size-8 rounded-full",
				orientation === "horizontal"
					? "top-1/2 -right-12 -translate-y-1/2"
					: "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
				className,
			)}
			disabled={!canScrollNext}
			onClick={scrollNext}
			{...props}
		>
			<ArrowRight />
			<span className="sr-only">Next slide</span>
		</Button>
	);
}

export {
	Carousel,
	type CarouselApi,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
};
