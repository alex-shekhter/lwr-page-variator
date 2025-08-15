import { isAuraCheck, isInBuilderCheck } from 'c/dynLoadUtils';

describe('c-dyn-load-utils', () => {
    afterEach(() => {
        // Reset the window object to a clean state
        delete window.location;
        delete window.$A;
    });

    describe('isAuraCheck', () => {
        it('should return true if window.$A is defined', () => {
            // Mock window.$A to simulate Aura environment
            window.$A = {};
            expect(isAuraCheck()).toBe(true);
        });

        it('should return false if window.$A is undefined', () => {
            // Ensure window.$A is not defined (or explicitly delete it)
            delete window.$A;
            expect(isAuraCheck()).toBe(false);
        });
    });

    describe('isInBuilderCheck', () => {
        it('should return true if the URL contains ".live-preview.salesforce-experience.com"', () => {
            // Mock window.location.href to simulate Experience Builder URL
            window.location = {
                href: 'https://test.live-preview.salesforce-experience.com/test/home'
            };
            expect(isInBuilderCheck()).toBe(true);
        });

        it('should return false if the URL does not contain ".live-preview.salesforce-experience.com"', () => {
            // Mock window.location.href to simulate a non-Experience Builder URL
            window.location = {
                href: 'https://test.salesforce.com/test/home'
            };
            expect(isInBuilderCheck()).toBe(false);
        });

        it('should handle empty URL', () => {
            window.location = { href: '' };
            expect(isInBuilderCheck()).toBe(false);
        });
    });
});