import type { LiveDataWidget } from "../widget/live-data-widget";

export class SubscriptionManager {
    private subs: Map<string, Set<LiveDataWidget>> = new Map();

    register(topic: string, w: LiveDataWidget): boolean {
        let set = this.subs.get(topic);
        if (!set) {
            set = new Set();
            this.subs.set(topic, set);
        }
        const firstSubscriber = set.size === 0;
        set.add(w);
        return firstSubscriber;
    }

    unregister(topic: string, w: LiveDataWidget): boolean {
        const set = this.subs.get(topic);
        if (!set) return false;
        set.delete(w);
        if (set.size === 0) {
            this.subs.delete(topic);
            return true;
        }
        return false;
    }

    widgetsFor(topic: string): LiveDataWidget[] {
        return Array.from(this.subs.get(topic) ?? []);
    }

    allTopics(): string[] {
        return Array.from(this.subs.keys());
    }

    clear(): void {
        this.subs.clear();
    }
}
