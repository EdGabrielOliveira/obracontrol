export class ConstructionError extends Error {
	constructor(
		public code: string,
		message: string,
		public status: number = 400,
		public details?: Array<{
			row?: number;
			field?: string;
			code: string;
			message: string;
		}>,
	) {
		super(message);
		this.name = "ConstructionError";
	}
}
