import { TOPICS, MESSAGE_FACTORY } from 'c/dynLoaderMessageHelper';

describe('c-dyn-loader-message-helper', () => {
    it('should define TOPICS as an object with the correct properties', () => {
        expect(TOPICS).toBeDefined();
        expect(TOPICS.DYN_CMP_REGISTER).toBe('DYN_CMP_REGISTER');
        expect(TOPICS.DYN_CMP_VISIBLE).toBe('DYN_CMP_VISIBLE');
        expect(TOPICS.DYN_CMP_IS_AVAILABLE).toBe('DYN_CMP_IS_AVAILABLE');
        expect(TOPICS.DYN_CMP_CMD_SHOW).toBe('DYN_CMP_CMD_SHOW');
        expect(TOPICS.DYN_CMP_BUILDER_CHG_VISIBILITY).toBe('DYN_CMP_BUILDER_CHG_VISIBILITY');
        expect(TOPICS.DYN_CMP_PAGE_AUDIENCE_CHANGED).toBe('DYN_CMP_PAGE_AUDIENCE_CHANGED');
        expect(TOPICS.DYN_CMP_REMOVED_FROM_BUILDER).toBe('DYN_CMP_REMOVED_FROM_BUILDER');
        // Ensure TOPICS is frozen to prevent modification
        expect(() => { TOPICS.NEW_TOPIC = 'NEW'; }).toThrow(TypeError);
    });

    it('should define MESSAGE_FACTORY as an object with the correct properties and functions', () => {
        expect(MESSAGE_FACTORY).toBeDefined();
        expect(MESSAGE_FACTORY.DYN_CMP_REGISTER).toBeInstanceOf(Function);
        expect(MESSAGE_FACTORY.DYN_CMP_VISIBLE).toBeInstanceOf(Function);
        expect(MESSAGE_FACTORY.DYN_CMP_IS_AVAILABLE).toBeInstanceOf(Function);
        expect(MESSAGE_FACTORY.DYN_CMP_CMD_SHOW).toBeInstanceOf(Function);
        expect(MESSAGE_FACTORY.DYN_CMP_BUILDER_CHG_VISIBILITY).toBeInstanceOf(Function);
        expect(MESSAGE_FACTORY.DYN_CMP_PAGE_AUDIENCE_CHANGED).toBeInstanceOf(Function);
        expect(MESSAGE_FACTORY.DYN_CMP_REMOVED_FROM_BUILDER).toBeInstanceOf(Function);
        // Ensure MESSAGE_FACTORY is frozen
        expect(() => { MESSAGE_FACTORY.NEW_FACTORY = 'NEW'; }).toThrow(TypeError);
    });

    it('MESSAGE_FACTORY.DYN_CMP_REGISTER should return the correct message format', () => {
        const mockDynCmpLoaderInstance = {
            componentId: 'cmp1',
            pageAudience: 'page1',
            compAudience: 'comp1',
            loadingMode: 'lazy',
            loadingOrder: 2
        };
        const expectedMessage = {
            topic: TOPICS.DYN_CMP_REGISTER,
            payload: {
                cmpId: 'cmp1',
                pageAudience: 'page1',
                compAudience: 'comp1',
                loadMode: 'lazy',
                loadingOrder: 2
            }
        };
        expect(MESSAGE_FACTORY.DYN_CMP_REGISTER(mockDynCmpLoaderInstance)).toEqual(expectedMessage);
    });

    it('MESSAGE_FACTORY.DYN_CMP_VISIBLE should return the correct message format', () => {
        const mockDynCmpLoaderInstance = {
            componentId: 'cmp2',
            pageAudience: 'page2',
            compAudience: 'comp2',
            loadingMode: 'onvisible',
            loadingOrder: 1
        };
        const expectedMessage = {
            topic: TOPICS.DYN_CMP_VISIBLE,
            payload: {
                cmpId: 'cmp2',
                pageAudience: 'page2',
                compAudience: 'comp2',
                loadMode: 'onvisible',
                loadingOrder: 1
            }
        };
        expect(MESSAGE_FACTORY.DYN_CMP_VISIBLE(mockDynCmpLoaderInstance)).toEqual(expectedMessage);
    });

    it('MESSAGE_FACTORY.DYN_CMP_IS_AVAILABLE should return the correct message format', () => {
        const targetCmp = 'cmp3';
        const expectedMessage = {
            topic: TOPICS.DYN_CMP_IS_AVAILABLE,
            payload: {
                targetCmp: 'cmp3'
            }
        };
        expect(MESSAGE_FACTORY.DYN_CMP_IS_AVAILABLE(targetCmp)).toEqual(expectedMessage);
    });

    it('MESSAGE_FACTORY.DYN_CMP_CMD_SHOW should return the correct message format', () => {
        const targetCmp = 'cmp4';
        const showNow = true;
        const expectedMessage = {
            topic: TOPICS.DYN_CMP_CMD_SHOW,
            payload: {
                targetCmp: 'cmp4',
                showNow: true
            }
        };
        expect(MESSAGE_FACTORY.DYN_CMP_CMD_SHOW(targetCmp, showNow)).toEqual(expectedMessage);
    });

    it('MESSAGE_FACTORY.DYN_CMP_BUILDER_CHG_VISIBILITY should return the correct message format', () => {
        const targetCmp = 'cmp5';
        const showOrHide = false;
        const expectedMessage = {
            topic: TOPICS.DYN_CMP_BUILDER_CHG_VISIBILITY,
            payload: {
                targetCmp: 'cmp5',
                showNow: false
            }
        };
        expect(MESSAGE_FACTORY.DYN_CMP_BUILDER_CHG_VISIBILITY(targetCmp, showOrHide)).toEqual(expectedMessage);
    });

    it('MESSAGE_FACTORY.DYN_CMP_PAGE_AUDIENCE_CHANGED should return the correct message format', () => {
        const mockDynCmpLoaderInstance = {
            componentId: 'cmp6',
            pageAudience: 'newPage'
        };
        const expectedMessage = {
            topic: TOPICS.DYN_CMP_PAGE_AUDIENCE_CHANGED,
            payload: {
                cmpId: 'cmp6',
                pageAudience: 'newPage'
            }
        };
        expect(MESSAGE_FACTORY.DYN_CMP_PAGE_AUDIENCE_CHANGED(mockDynCmpLoaderInstance)).toEqual(expectedMessage);
    });

    it('MESSAGE_FACTORY.DYN_CMP_REMOVED_FROM_BUILDER should return the correct message format', () => {
        const mockDynCmpLoaderInstance = {
            componentId: 'cmp7'
        };
        const expectedMessage = {
            topic: TOPICS.DYN_CMP_REMOVED_FROM_BUILDER,
            payload: {
                cmpId: 'cmp7'
            }
        };
        expect(MESSAGE_FACTORY.DYN_CMP_REMOVED_FROM_BUILDER(mockDynCmpLoaderInstance)).toEqual(expectedMessage);
    });
});