import { ConditionInterpreter } from 'c/audience_rules_interpreter';

describe('ConditionInterpreter', () => {
    let interpreter;
    let context;

    beforeEach(() => {
        context = {
            Profile: 'System Administrator',
            Permission: new Set(['View orders', 'Edit orders', 'Delete orders']),
            Location: new Set(['Canada', 'USA', 'Austria']),
            Role: 'Big Boss',
            Domain: 'example.com',
            Audience: "SysAdminEditOrders",
            AudiencesByName: new Map([
                ["AmericaLoc", "Location == 'Canada' || Location == 'USA'"],
                ["SysAdminEditOrdersInAmerica", "(Profile == 'System Administrator' && Permission == 'Edit orders') && Audience == 'AmericaLoc'"]
            ]),
            Data: new Map() // SObjectName => List<SObject>
        };
        interpreter = new ConditionInterpreter(context);
    });

    it('should evaluate complex AND condition with Audience', () => {
        const condition = context.AudiencesByName.get("SysAdminEditOrdersInAmerica");
        const result = interpreter.evaluate(condition);
        expect(result).toBe(true);
    });

    it('should evaluate simple AND condition', () => {
        const condition = "Profile == 'System Administrator' && Permission == 'Edit orders'";
        const result = interpreter.evaluate(condition);
        expect(result).toBe(true);
    });

    it('should evaluate simple OR condition', () => {
        const condition = "Location == 'Canada' || Location == 'USA'";
        const result = interpreter.evaluate(condition);
        expect(result).toBe(true);
    });

    it('should return false for invalid permission', () => {
        const condition = "Permission == 'Invalid Permission'";
        const result = interpreter.evaluate(condition);
        expect(result).toBe(false);
    });

    it('should throw error for unknown variable', () => {
        const condition = "UnknownVar == 'Test'";
        expect(() => interpreter.evaluate(condition)).toThrow(/Unknown variable/);
    });

    it('should return false for string literal with escape char', () => {
        const condition = "Profile == 'System Administrator\\'s Role'";
        const result = interpreter.evaluate(condition);
        expect(result).toBe(false);
    });

    it('should evaluate boolean AND conditions', () => {
        expect(interpreter.evaluate("true && true")).toBe(true);
        expect(interpreter.evaluate("true && false")).toBe(false);
        expect(interpreter.evaluate("false && true")).toBe(false);
        expect(interpreter.evaluate("false && false")).toBe(false);
    });

    it('should evaluate boolean OR conditions', () => {
        expect(interpreter.evaluate("true || true")).toBe(true);
        expect(interpreter.evaluate("true || false")).toBe(true);
        expect(interpreter.evaluate("false || true")).toBe(true);
        expect(interpreter.evaluate("false || false")).toBe(false);
    });

    it('should evaluate combined conditions with parenthesis', () => {
        const condition = "((Permission == 'View orders' || Permission == 'Edit orders') && (Location == 'Canada'))";
        const result = interpreter.evaluate(condition);
        expect(result).toBe(true);
    });

    it('should throw error for unterminated string literal', () => {
        const condition = "Profile == 'Unterminated string literal";
        expect(() => interpreter.evaluate(condition)).toThrow(/Unterminated string literal/);
    });

    it('should throw error for invalid escape sequence', () => {
        const condition = "Permission == 'Test\\x'";
        expect(() => interpreter.evaluate(condition)).toThrow(/Invalid escape sequence/);
    });

    it('should throw error for invalid operator', () => {
        const condition = "Profile === 'Test'";
        expect(() => interpreter.evaluate(condition)).toThrow(/Unknown operator/);
    });

    it('should throw error for unclosed parenthesis', () => {
        const condition = "((Permission == 'View orders'";
        expect(() => interpreter.evaluate(condition)).toThrow(/Unclosed parenthesis/);
    });

    it('should evaluate endsWith operator', () => {
        expect(interpreter.evaluate("Profile ~= 'Administrator'")).toBe(true);
        expect(interpreter.evaluate("Profile ~= 'admin'")).toBe(false);
    });

    it('should evaluate startsWith operator', () => {
        expect(interpreter.evaluate("Profile =~ 'System'")).toBe(true);
        expect(interpreter.evaluate("Profile =~ 'system'")).toBe(false);
    });

    it('should evaluate endsWith operator with Set', () => {
        expect(interpreter.evaluate("Location ~= 'tria'")).toBe(true);
        expect(interpreter.evaluate("Location ~= 'tria1'")).toBe(false);
    });

    it('should evaluate startsWith operator with Set', () => {
        expect(interpreter.evaluate("Location =~ 'Aus'")).toBe(true);
        expect(interpreter.evaluate("Location =~ 'aus'")).toBe(false);
    });

    it('should evaluate NOT EQUAL operator with Set', () => {
        expect(interpreter.evaluate("Location != 'Invalid Location'")).toBe(true);
        expect(interpreter.evaluate("Location != 'Canada'")).toBe(false);
    });

    it('should evaluate EQUAL operator with Set', () => {
        expect(interpreter.evaluate("Location == 'Canada'")).toBe(true);
        expect(interpreter.evaluate("Location == 'Invalid Location'")).toBe(false);
    });

    it('should evaluate boolean string', () => {
        expect(interpreter.evaluate("true == 'true'")).toBe(true);
        expect(interpreter.evaluate("false == 'false'")).toBe(true);
        expect(interpreter.evaluate("true == 'false'")).toBe(false);
    });
});