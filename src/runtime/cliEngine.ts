import { createMarpEngine } from './marpEngine';

export default function createCliEngine(options: Parameters<typeof createMarpEngine>[0] = {}) {
	return createMarpEngine(options);
}
