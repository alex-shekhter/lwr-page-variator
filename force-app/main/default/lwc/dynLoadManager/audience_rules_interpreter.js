class ParsingError extends Error {
  constructor(message, position) {
    super(message);
    this.line = 1;
    this.column = position;
    this.name = "ParsingError";
  }
}

const resultToLiteral = (res) => { return { "type": "literal", "value": res }; }
const literalToValue = (res) => res.value;

const isBooleanString = (str) => {
  if (typeof str !== 'string') {
    return false;
  }
  const lowerCaseStr = str.toLowerCase();
  return lowerCaseStr === 'true' || lowerCaseStr === 'false';
}
const stringToBoolean = (str) => {
  let bv = (/^true$/i.test( str ) ) ? true : (/^false$/i.test( str ) ) ? false : undefined;
  if ( bv !== undefined ) {
    return bv;
  }
  return str;
}

const isBoolean = (bool) => typeof bool === "boolean";

export class ConditionInterpreter {
  constructor(context) {
    this.setContext(context);
  }

  setContext(context) {
    this.context = {
      Audience: context.Audience || "", // Audience is condition in the string form
      AudiencesByName:
      context.AudiencesByName instanceof Map
        ? context.AudiencesByName
        : new Map(),
      Profile: context.Profile || "",
      Role: context.Role || "",
      Location:
        context.Location instanceof Set
          ? context.Location
          : new Set(context.Location || []),
      Domain: context.Domain || "",
      Permission:
        context.Permission instanceof Set
          ? context.Permission
          : new Set(context.Permission || []),
      Data: context.Data instanceof Map
        ? context.Data
        : new Map(),
    };
  }

  evaluate(conditionString) {
    try {
      const tokens = this.tokenize(conditionString);
      this.validateTokens(tokens);
      const rpn = this.shuntingYard(tokens);
      return literalToValue( this.evaluateRPN(rpn) );
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError(error.message, this.currentPosition);
    }
  }

  tokenize(input) {
    const tokens = [];
    let current = "";
    let inString = false;
    let escaping = false;
    this.currentPosition = 0;

    for (let i = 0; i < input.length; i++) {
      this.currentPosition = i + 1;
      const char = input[i];

      if (char === "\\" && !escaping) {
        escaping = true;
        continue;
      }

      if (char === "'" && !escaping) {
        if (!inString && !current.trim()) {
          inString = true;
          continue;
        }
        if (inString) {
          tokens.push({ type: "literal", value: current });
          current = "";
          inString = false;
          continue;
        }
        throw new ParsingError("Unexpected single quote", i + 1);
      }

      if (escaping) {
        if (char !== "'") {
          throw new ParsingError("Invalid escape sequence", i + 1);
        }
        current += char;
        escaping = false;
        continue;
      }

      if (inString) {
        current += char;
        continue;
      }

      if (char === " ") {
        if (current) {
          tokens.push(this.categorizeToken(current));
          current = "";
        }
        continue;
      }

      if ("()&|=!~".includes(char)) {
      // if ("()&&||==!=~==~".includes(char)) {
          if (current) {
          tokens.push(this.categorizeToken(current));
          current = "";
        }
        
        if ( input.length === (i + 1) && !"()".includes(char) ) {
          throw new ParsingError( `Input truncated.. char=${char} i=${i}; length=${input.length}` );
        }

        if (char === "&" && input[i + 1] === "&") {
          tokens.push({ type: "operator", value: "&&" });
          i++;
        } else if (char === "|" && input[i + 1] === "|") {
          tokens.push({ type: "operator", value: "||" });
          i++;
        } else if (char === "=" && input[i + 1] === "=") {
          tokens.push({ type: "operator", value: "==" });
          i++;
        } else if (char === "!" && input[i + 1] === "=") {
          tokens.push({ type: "operator", value: "!=" });
          i++;
        } else if (char === "~" && input[i + 1] == "=") {
          // endsWith
          tokens.push({ type: "operator", value: "~=" });
          i++;
        } else if (char === '=' && input[i + 1] == '~' ) { 
          // startsWith
          tokens.push({ type: "operator", value: "=~" });
          i++;
        } else if (char === "(" || char === ")") {
          tokens.push({ type: "parenthesis", value: char });
        } else if ( !"&|=~".includes(input[i + 1]) ) {
          throw new ParsingError( "Unknown operator" );
        }
        continue;
      }

      current += char;
    }

    if (inString) {
      throw new ParsingError("Unterminated string literal", input.length);
    }

    if (current) {
      tokens.push(this.categorizeToken(current));
    }

    return tokens;
  }

  validateTokens(tokens) {
    let openParens = 0;
    let expectOperator = false;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === "parenthesis") {
        if (token.value === "(") {
          openParens++;
        } else {
          openParens--;
          if (openParens < 0) {
            throw new ParsingError(
              "Unmatched closing parenthesis",
              this.currentPosition
            );
          }
        }
      }

      if (
        expectOperator &&
        (token.type === "literal" || token.type === "variable")
      ) {
        throw new ParsingError("Expected operator", this.currentPosition);
      }

      if (!expectOperator && token.type === "operator") {
        throw new ParsingError("Unexpected operator", this.currentPosition);
      }

      expectOperator =
        token.type === "literal" ||
        token.type === "variable" ||
        token.value === ")";
    }

    if (openParens > 0) {
      throw new ParsingError("Unclosed parenthesis", this.currentPosition);
    }
  }

  tokenToObjAndFields(token) {
    const parts = token.split(".");
    const objApiName = parts[0];
    const fields = parts.slice( 1 ).join( "." );
    console.debug( `--->>> ConditionInterpreter::tokenToObjAndFields objApiName: `, objApiName, ` fields: `, fields );
    return { objApiName, fields };
  }

  categorizeToken(token) {
    // Check if token matches any context variable
    if (!token.startsWith("'")) {
      if ( isBoolean( token ) ) {
        return { type: "literal", value: token };
      }
      else if ( isBooleanString( token ) ) {
        return { type: "literal", value: stringToBoolean( token ) };
      }
      if (!Object.keys(this.context).includes(token) ) {
        // We need to check in this.context.Data too
        const objAndFields = this.tokenToObjAndFields( token );
        const objExists = this.context.Data.has( objAndFields.objApiName );
        const fldExists = (objExists) ? this.context.Data.get(  objAndFields.objApiName ).has(  objAndFields.fields ) : undefined;
        
        // TODO: remove bandaid below. Apex needs to return all fields with default or "empty" values
        if ( objExists && !fldExists) { 
          this.context.Data.get( objAndFields.objApiName ).set( objAndFields.fields, '' );
          fldExists = true;
        }
        
        if ( objExists && fldExists ) {
          return { type: "variable", value: token, obj: objAndFields.objApiName, field: objAndFields.fields };
        }
        throw new ParsingError(
          `Unknown variable: ${token}`,
          this.currentPosition
        );
      }
      return { type: "variable", value: token };
    }
    return { type: "literal", value: token };
  }

  shuntingYard(tokens) {
    const output = [];
    const operators = [];
    const precedence = {
      "&&": 2,
      "||": 1,
      "==": 3,
      "!=": 3,
      "=~": 3,
      "~=": 3
    };

    for (const token of tokens) {
      if (token.type === "literal" || token.type === "variable") {
        output.push(token);
      } else if (token.type === "operator") {
        while (
          operators.length > 0 &&
          operators[operators.length - 1].type === "operator" &&
          precedence[operators[operators.length - 1].value] >=
            precedence[token.value]
        ) {
          output.push(operators.pop());
        }
        operators.push(token);
      } else if (token.value === "(") {
        operators.push(token);
      } else if (token.value === ")") {
        while (
          operators.length > 0 &&
          operators[operators.length - 1].value !== "("
        ) {
          output.push(operators.pop());
        }
        operators.pop();
      }
    }

    while (operators.length > 0) {
      output.push(operators.pop());
    }

    return output;
  }

  evaluateRPN(rpn) {
    const stack = [];

    for (const token of rpn) {
      if (token.type === "literal" || token.type === "variable") {
        stack.push(this.resolveValue(token));
      } else if (token.type === "operator") {
        const right = stack.pop();
        const left = stack.pop();
        let variable = left;
        let literal = right;
        if ( right.type === "variable" ) {
          variable = right;
          literal = left;
        }
        stack.push(this.evaluateOperation(token.value, variable, literal));
      }
    }

    return stack[0];
  }

  resolveVariableValueFromContext( token ) {
    let resolvedValue = token.value;
    if ( token.value !== "Audience" ) {
      if ( token.obj && token.field ) {
        resolvedValue = this.context.Data.get( token.obj ).get( token.field );
      }
      else {
        resolvedValue = this.context[ token.value ];
      }
    }
    return resolvedValue;
  }

  resolveValue(token) {
    if (token.type === "variable") {
      return {
        type: "variable",
        // We don't want to process Audience now. It will be done later during interpretation
        // when we will have lval + op + rval together 
        value: this.resolveVariableValueFromContext( token ) // (token.value === "Audience") ? token.value : this.context[token.value]
      };
    }
    return {
      type: "literal",
      value: token.value
    };
  }

  compareValues(variable, literal, operator) {
    if ( variable.type === "variable" && variable.value === "Audience" ) {
      const interpreter = new ConditionInterpreter(this.context);
      return interpreter.evaluate( this.context.AudiencesByName.get( literal.value ) );
    }

    const compareSetWithLiteral = (setVal, operator, literalVal) => {
      if ( !(setVal instanceof Set) ) {
        return undefined;
      }
      
      if (operator === "==") {
        return setVal.has( literalVal );
      } else if (operator === "!=" ) {
        return !setVal.has( literalVal );
      } else if (operator === "=~") { // startsWith
        const res = [...setVal].filter(lv=>lv && lv.startsWith( literalVal ));
        return res.length > 0;
      } else if (operator === "~=") { // endsWith
        const res = [...setVal].filter(lv=>lv && lv.endsWith( literalVal ));
        return res.length > 0;
      }
    }

    let res = compareSetWithLiteral( variable.value, operator, literal.value );
    if ( res !== undefined ) {
      return  res;
    }

    const prepBooleansForCompare = (val) => isBooleanString( val ) ? stringToBoolean( val ) : val;

    variable.value = prepBooleansForCompare( variable.value );
    literal.value = prepBooleansForCompare( literal.value );

    if (operator === "==") {
      return variable.value === literal.value;
    }
    if (operator === "!=") {
      return variable.value !== literal.value;
    }
    if (operator === "=~") {
      return variable.value.startsWith( literal.value );
    }
    if (operator === "~=") {
      return variable.value.endsWith( literal.value );
    }
  }

  evaluateOperation(operator, variable, literal) {
    switch (operator) {
      case "&&":
        return resultToLiteral( variable.value && literal.value );
      case "||":
        return resultToLiteral( variable.value || literal.value );
      case "==":
      case "!=":
      case "=~":
      case "~=":    
        return resultToLiteral( this.compareValues(variable, literal, operator) );
      default:
        throw new ParsingError(
          `Unknown operator: ${operator}`,
          this.currentPosition
        );
    }
  }
}
