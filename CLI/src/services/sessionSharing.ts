import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

interface SharedSessionMetadata {
  sessionId: string;
  shareLink: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessedAt?: number;
  revoked: boolean;
  accessControlList?: string[];
}

interface SharedSessionData {
  sessionId: string;
  shareLink: string;
  metadata: SharedSessionMetadata;
  valid: boolean;
  expired: boolean;
  accessDenied?: boolean;
}

class SessionSharingManager {
  private storageDir: string;
  private storageFile: string;
  private sessionManager: any;
  private sharedSessions: Map<string, SharedSessionMetadata>;

  constructor() {
    this.storageDir = path.join(os.homedir(), '.apex');
    this.storageFile = path.join(this.storageDir, 'shared-sessions.json');
    this.sharedSessions = new Map();
    this.initializeStorage();
  }

  /**
   * Initialize storage directory and load existing shared sessions
   */
  private initializeStorage(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      if (fs.existsSync(this.storageFile)) {
        const data = fs.readFileSync(this.storageFile, 'utf-8');
        const parsed = JSON.parse(data);
        
        for (const metadata of parsed) {
          this.sharedSessions.set(metadata.sessionId, metadata);
        }
      }
    } catch (error) {
      console.error('Failed to initialize session sharing storage:', error);
    }
  }

  /**
   * Persist shared sessions to storage
   */
  private persistStorage(): void {
    try {
      const data = Array.from(this.sharedSessions.values());
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to persist session sharing data:', error);
    }
  }

  /**
   * Generate a secure random token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a shareable link for a session
   */
  public generateShareLink(sessionId: string, expirationHours: number = 24): SharedSessionMetadata {
    const token = this.generateToken();
    const shareLink = `apex://share/${token}`;
    const now = Date.now();
    const expiresAt = now + expirationHours * 60 * 60 * 1000;

    const metadata: SharedSessionMetadata = {
      sessionId,
      shareLink,
      token,
      createdAt: now,
      expiresAt,
      accessCount: 0,
      revoked: false,
      accessControlList: [],
    };

    this.sharedSessions.set(sessionId, metadata);
    this.persistStorage();

    return metadata;
  }

  /**
   * Get the share link for an existing session
   */
  public getShareLink(sessionId: string): SharedSessionMetadata | null {
    const metadata = this.sharedSessions.get(sessionId);
    if (!metadata || metadata.revoked) {
      return null;
    }
    return metadata;
  }

  /**
   * Validate if a share link is valid and not expired
   */
  public validateShareLink(link: string): boolean {
    const token = this.extractTokenFromLink(link);
    if (!token) {
      return false;
    }

    for (const metadata of this.sharedSessions.values()) {
      if (metadata.token === token && !metadata.revoked) {
        const now = Date.now();
        if (now <= metadata.expiresAt) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract token from a share link
   */
  private extractTokenFromLink(link: string): string | null {
    const match = link.match(/^apex:\/\/share\/([a-f0-9]{64})$/);
    return match ? match[1] : null;
  }

  /**
   * Revoke a share link
   */
  public revokeShareLink(sessionId: string): boolean {
    const metadata = this.sharedSessions.get(sessionId);
    if (!metadata) {
      return false;
    }

    metadata.revoked = true;
    this.persistStorage();
    return true;
  }

  /**
   * Get all shared sessions
   */
  public getSharedSessions(): SharedSessionMetadata[] {
    const now = Date.now();
    const shared = Array.from(this.sharedSessions.values()).filter((metadata) => {
      return !metadata.revoked && now <= metadata.expiresAt;
    });

    return shared;
  }

  /**
   * Access a shared session using a share link
   */
  public accessSharedSession(link: string, userAccessId?: string): SharedSessionData {
    const token = this.extractTokenFromLink(link);
    if (!token) {
      return {
        sessionId: '',
        shareLink: link,
        metadata: {} as SharedSessionMetadata,
        valid: false,
        expired: false,
      };
    }

    let foundMetadata: SharedSessionMetadata | null = null;

    for (const metadata of this.sharedSessions.values()) {
      if (metadata.token === token) {
        foundMetadata = metadata;
        break;
      }
    }

    if (!foundMetadata) {
      return {
        sessionId: '',
        shareLink: link,
        metadata: {} as SharedSessionMetadata,
        valid: false,
        expired: false,
      };
    }

    const now = Date.now();
    const isExpired = now > foundMetadata.expiresAt;
    const isRevoked = foundMetadata.revoked;

    if (!isExpired && !isRevoked) {
      // Check access control list if set
      if (foundMetadata.accessControlList && foundMetadata.accessControlList.length > 0) {
        if (userAccessId && !foundMetadata.accessControlList.includes(userAccessId)) {
          return {
            sessionId: foundMetadata.sessionId,
            shareLink: link,
            metadata: foundMetadata,
            valid: false,
            expired: false,
            accessDenied: true,
          };
        }
      }

      // Increment access count and update last accessed time
      foundMetadata.accessCount++;
      foundMetadata.lastAccessedAt = now;
      this.persistStorage();

      return {
        sessionId: foundMetadata.sessionId,
        shareLink: link,
        metadata: foundMetadata,
        valid: true,
        expired: false,
      };
    }

    return {
      sessionId: foundMetadata.sessionId,
      shareLink: link,
      metadata: foundMetadata,
      valid: false,
      expired: isExpired,
    };
  }

  /**
   * Set custom expiration time for a share link
   */
  public setLinkExpiration(sessionId: string, hours: number): boolean {
    const metadata = this.sharedSessions.get(sessionId);
    if (!metadata) {
      return false;
    }

    const now = Date.now();
    metadata.expiresAt = now + hours * 60 * 60 * 1000;
    this.persistStorage();

    return true;
  }

  /**
   * Update access control list for a share link
   */
  public setAccessControlList(sessionId: string, userIds: string[]): boolean {
    const metadata = this.sharedSessions.get(sessionId);
    if (!metadata) {
      return false;
    }

    metadata.accessControlList = userIds;
    this.persistStorage();

    return true;
  }

  /**
   * Add a user to the access control list
   */
  public addAccessControl(sessionId: string, userId: string): boolean {
    const metadata = this.sharedSessions.get(sessionId);
    if (!metadata) {
      return false;
    }

    if (!metadata.accessControlList) {
      metadata.accessControlList = [];
    }

    if (!metadata.accessControlList.includes(userId)) {
      metadata.accessControlList.push(userId);
      this.persistStorage();
    }

    return true;
  }

  /**
   * Remove a user from the access control list
   */
  public removeAccessControl(sessionId: string, userId: string): boolean {
    const metadata = this.sharedSessions.get(sessionId);
    if (!metadata || !metadata.accessControlList) {
      return false;
    }

    const index = metadata.accessControlList.indexOf(userId);
    if (index > -1) {
      metadata.accessControlList.splice(index, 1);
      this.persistStorage();
      return true;
    }

    return false;
  }

  /**
   * Get statistics for a shared session
   */
  public getShareLinkStats(sessionId: string): Partial<SharedSessionMetadata> | null {
    const metadata = this.sharedSessions.get(sessionId);
    if (!metadata) {
      return null;
    }

    return {
      sessionId: metadata.sessionId,
      accessCount: metadata.accessCount,
      createdAt: metadata.createdAt,
      expiresAt: metadata.expiresAt,
      lastAccessedAt: metadata.lastAccessedAt,
      revoked: metadata.revoked,
    };
  }

  /**
   * Clean up expired share links
   */
  public cleanupExpiredLinks(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [sessionId, metadata] of this.sharedSessions.entries()) {
      if (now > metadata.expiresAt) {
        this.sharedSessions.delete(sessionId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.persistStorage();
    }

    return removedCount;
  }
}

export const sessionSharing = new SessionSharingManager();
