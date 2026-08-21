import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface SafeBoundaryProps {
	children: ReactNode;
}

interface SafeBoundaryState {
	hasError: boolean;
	errorKey: number;
}

export class SafeBoundary extends Component<
	SafeBoundaryProps,
	SafeBoundaryState
> {
	constructor(props: SafeBoundaryProps) {
		super(props);
		this.state = { hasError: false, errorKey: 0 };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	handleReset = () => {
		this.setState({ hasError: false, errorKey: this.state.errorKey + 1 });
	};

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex flex-col items-center justify-center gap-4 p-8">
					<p className="text-sm text-destructive">Erro inesperado.</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={this.handleReset}
					>
						Tentar novamente
					</Button>
				</div>
			);
		}
		return this.props.children;
	}
}
