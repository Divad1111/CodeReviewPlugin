/**
 * JWT authentication middleware.
 */
import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from '../types/shared';
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
/**
 * Verify JWT token and attach user payload to request.
 */
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
/**
 * Require reviewer role.
 */
export declare function requireReviewer(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map