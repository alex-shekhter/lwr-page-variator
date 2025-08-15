/*********************************************************************************************
 * @Name SObjectNullValueSubstituter
 * @Group Common Utility
 * @description Utility class that replaces null values in SObject fields with default or "empty" values.
 * First uses the field's default value if available, then falls back to type-appropriate empty values.
 * Handles both direct fields and relationship fields (standard and custom).
 **********************************************************************************************/
@SuppressWarnings( 'PMD.CognitiveComplexity, PMD.ExcessiveParameterList, PMD.NcssMethodCount' )
public inherited sharing class SObjectNullValueSubstituter {
    
    // The SObject record being processed
    private final SObject record;
    
    // Cache for parsed field paths to avoid repeated splitting
    private final Map<String, List<String>> pathPartsCache;
    
    // Cache for field type information to avoid repeated schema lookups
    private final Map<String, Schema.DisplayType> fieldTypeCache;
    
    // Cache for field default values
    private final Map<String, Object> fieldDefaultCache;
    
    // Flag to determine exception handling behavior
    private final Boolean throwExceptionOnInvalidPath;
    
    /**************************************************************************************
     * @description Constructor - initialize with an SObject record.
     * @param record The SObject record to process.
     * @param throwExceptionOnInvalidPath Whether to throw exceptions for invalid field paths (default: true).
     **************************************************************************************/
    public SObjectNullValueSubstituter(SObject record, Boolean throwExceptionOnInvalidPath) {
        if (record == null && throwExceptionOnInvalidPath) {
            throw new SObjectNullValueSubstituterException('Record cannot be null');
        }
        
        this.record = record;
        this.pathPartsCache = new Map<String, List<String>>();
        this.fieldTypeCache = new Map<String, Schema.DisplayType>();
        this.fieldDefaultCache = new Map<String, Object>();
        this.throwExceptionOnInvalidPath = throwExceptionOnInvalidPath;
    }
    
    /**************************************************************************************
     * @description Constructor with default exception handling (throws exceptions).
     * @param record The SObject record to process.
     **************************************************************************************/
    public SObjectNullValueSubstituter(SObject record) {
        this(record, true);
    }
    
    /**************************************************************************************
     * @description Process a single SObject, replacing all null values for the specified fields
     * with their default values or appropriate empty values.
     * @param fieldPaths List of field paths to process.
     * @return SObject A clone of the original SObject with null values replaced.
     **************************************************************************************/
    public SObject substituteNullValues(List<String> fieldPaths) {
        if (fieldPaths == null || fieldPaths.isEmpty()) {
            return this.record;
        }
        
        // Clone the SObject to avoid modifying the original
        SObject result = this.record.clone(true, true, true, true);
        
        // Process each field path
        for (String fieldPath : fieldPaths) {
            substituteNullValueForField(result, fieldPath);
        }
        
        return result;
    }
    
    /**************************************************************************************
     * @description Substitute a null value for a specific field in the SObject.
     * @param targetSObject The SObject to modify (must be a clone of the original).
     * @param fieldPath The field path to process.
     **************************************************************************************/
    private void substituteNullValueForField(SObject targetSObject, String fieldPath) {
        if (String.isBlank(fieldPath)) {
            return;
        }
        
        try {
            // Get path parts
            List<String> pathParts = getPathParts(fieldPath);
            
            // For simple fields (no relationships)
            if (pathParts.size() == 1) {
                String fieldName = pathParts[0];
                Object value = targetSObject.get(fieldName);
                
                // If value is null, replace it with default or empty value
                if (value == null) {
                    Object replacementValue = getDefaultOrEmptyValueForField(fieldPath);
                    targetSObject.put(fieldName, replacementValue);
                }
                return;
            }
            
            // For relationship fields, we need to navigate the relationship chain
            SObject currentObj = targetSObject;
            SObject parentObj = null;
            String lastRelationshipName = null;
            
            // Process all parts except the last one (the actual field)
            for (Integer i = 0; i < pathParts.size() - 1; i++) {
                String part = pathParts[i];
                parentObj = currentObj;
                
                // Get the related object
                currentObj = currentObj.getSObject(part);
                lastRelationshipName = part;
                
                // If any related object is null, we need to create it
                if (currentObj == null) {
                    // Determine the SObject type for this relationship
                    Schema.SObjectType parentType = parentObj.getSObjectType();
                    Schema.DescribeSObjectResult parentDescribe = parentType.getDescribe();
                    
                    Schema.SObjectField relationshipField = null;
                    Schema.SObjectType childType = null;
                    
                    // Handle standard relationships
                    relationshipField = parentDescribe.fields.getMap().get(part);
                    
                    if (relationshipField == null) {
                        // Try with Id suffix for standard lookup fields
                        relationshipField = parentDescribe.fields.getMap().get(part + 'Id');
                        
                        if (relationshipField == null && part.endsWith('__r')) {
                            // Handle custom relationship (CustomObject__r -> CustomObject__c)
                            String customFieldName = part.substring(0, part.length() - 1) + 'c';
                            relationshipField = parentDescribe.fields.getMap().get(customFieldName);
                        }
                    }
                    
                    if (relationshipField != null) {
                        Schema.DescribeFieldResult fieldDescribe = relationshipField.getDescribe();
                        List<Schema.SObjectType> referenceTo = fieldDescribe.getReferenceTo();
                        
                        if (!referenceTo.isEmpty()) {
                            childType = referenceTo[0];
                            // Create an empty SObject of the related type
                            currentObj = childType.newSObject();
                            // Link it to the parent
                            parentObj.putSObject(part, currentObj);
                        }
                    }
                    
                    // If we couldn't determine the relationship type
                    if (currentObj == null) {
                        if (throwExceptionOnInvalidPath) {
                            throw new SObjectNullValueSubstituterException('Invalid relationship field: ' + part);
                        }
                        return; // Skip this field if we can't determine the relationship
                    }
                }
            }
            
            // Process the final field
            String finalField = pathParts[pathParts.size() - 1];
            Object value = currentObj.get(finalField);
            
            // If the final field value is null, set the default or empty value
            if (value == null) {
                Object replacementValue = getDefaultOrEmptyValueForField(fieldPath);
                currentObj.put(finalField, replacementValue);
            }
            
        } catch (SObjectNullValueSubstituterException e) {
            // Always throw our custom exceptions
            throw e;
        } catch (Exception e) {
            if (throwExceptionOnInvalidPath) {
                throw new SObjectNullValueSubstituterException('Error processing field path: ' + fieldPath, e);
            }
            // Otherwise silently skip this field
        }
    }
    
    /**************************************************************************************
     * @description Parse and cache field path parts.
     * @param fieldPath The full field path (e.g., "RecordType.DeveloperName").
     * @return List<String> The parsed path parts.
     **************************************************************************************/
    private List<String> getPathParts(String fieldPath) {
        // Check cache first
        if (pathPartsCache.containsKey(fieldPath)) {
            return pathPartsCache.get(fieldPath);
        }
        
        // Parse and cache the path parts
        List<String> pathParts = fieldPath.split('\\.');
        pathPartsCache.put(fieldPath, pathParts);
        
        return pathParts;
    }
    
    /**************************************************************************************
     * @description Determine the appropriate value for null fields:
     * 1. First try to use the field's default value if defined.
     * 2. If no default exists, use an appropriate "empty" value based on field type.
     * @param fieldPath Path to the field.
     * @return Object The default or empty value for the field.
     **************************************************************************************/
    private Object getDefaultOrEmptyValueForField(String fieldPath) {
        // Check cache first to avoid repeated schema lookups
        if (fieldTypeCache.containsKey(fieldPath)) {
            Schema.DisplayType fieldType = fieldTypeCache.get(fieldPath);
            // We need to check if we have a default value for this field
            if (fieldDefaultCache.containsKey(fieldPath)) {
                Object defaultValue = fieldDefaultCache.get(fieldPath);
                return defaultValue != null ? defaultValue : getEmptyValueByDisplayType(fieldType);
            }
            return getEmptyValueByDisplayType(fieldType);
        }
        
        try {
            // Get the path parts
            List<String> pathParts = getPathParts(fieldPath);
            
            // Start with the record's object type
            Schema.SObjectType objectType = record.getSObjectType();
            Schema.DescribeSObjectResult objectDescribe = objectType.getDescribe();
            
            // Navigate to the relevant object for the field
            for (Integer i = 0; i < pathParts.size() - 1; i++) {
                String relationshipName = pathParts[i];
                Schema.SObjectField field = null;
                
                // Check for standard relationship name
                field = objectDescribe.fields.getMap().get(relationshipName);
                
                if (field == null) {
                    // Try with Id suffix for standard lookups
                    field = objectDescribe.fields.getMap().get(relationshipName + 'Id');
                    
                    if (field == null && relationshipName.endsWith('__r')) {
                        // Handle custom relationship (CustomObject__r -> CustomObject__c)
                        String customFieldName = relationshipName.substring(0, relationshipName.length() - 1) + 'c';
                        field = objectDescribe.fields.getMap().get(customFieldName);
                    }
                    
                    if (field == null) {
                        if (throwExceptionOnInvalidPath) {
                            throw new SObjectNullValueSubstituterException('Invalid relationship field: ' + relationshipName);
                        }
                        
                        // Default to STRING type and cache it
                        fieldTypeCache.put(fieldPath, Schema.DisplayType.STRING);
                        fieldDefaultCache.put(fieldPath, null);
                        return '';
                    }
                }
                
                Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
                List<Schema.SObjectType> referenceTo = fieldDescribe.getReferenceTo();
                
                if (referenceTo.isEmpty()) {
                    if (throwExceptionOnInvalidPath) {
                        throw new SObjectNullValueSubstituterException('Field is not a relationship: ' + relationshipName);
                    }
                    
                    // Not a relationship field, unexpected
                    fieldTypeCache.put(fieldPath, Schema.DisplayType.STRING);
                    fieldDefaultCache.put(fieldPath, null);
                    return '';
                }
                
                // Move to the related object
                objectDescribe = referenceTo[0].getDescribe();
            }
            
            // Get the final field's type and default value
            String finalFieldName = pathParts[pathParts.size() - 1];
            Schema.SObjectField finalField = objectDescribe.fields.getMap().get(finalFieldName);
            
            if (finalField == null) {
                if (throwExceptionOnInvalidPath) {
                    throw new SObjectNullValueSubstituterException('Invalid field: ' + finalFieldName);
                }
                
                // Field doesn't exist, default to STRING
                fieldTypeCache.put(fieldPath, Schema.DisplayType.STRING);
                fieldDefaultCache.put(fieldPath, null);
                return '';
            }
            
            // Get the field describe result
            Schema.DescribeFieldResult fieldDescribe = finalField.getDescribe();
            
            // Get and cache the field type
            Schema.DisplayType fieldType = fieldDescribe.getType();
            fieldTypeCache.put(fieldPath, fieldType);
            
            // Get and cache the default value if it exists
            Object defaultValue = null;
            if (fieldDescribe.getDefaultValue() != null) {
                defaultValue = fieldDescribe.getDefaultValue();
            }
            fieldDefaultCache.put(fieldPath, defaultValue);
            
            // Return the default value if it exists, otherwise return an empty value
            return defaultValue != null ? defaultValue : getEmptyValueByDisplayType(fieldType);
            
        } catch (SObjectNullValueSubstituterException e) {
            // Always throw our custom exceptions
            throw e;
        } catch (Exception e) {
            if (throwExceptionOnInvalidPath) {
                throw new SObjectNullValueSubstituterException('Error determining default/empty value for: ' + fieldPath, e);
            }
            
            // Default to STRING
            fieldTypeCache.put(fieldPath, Schema.DisplayType.STRING);
            fieldDefaultCache.put(fieldPath, null);
            return '';
        }
    }
    
    /**************************************************************************************
     * @description Get the appropriate empty value for a given display type.
     * @param fieldType The Salesforce display type.
     * @return Object The appropriate empty value.
     **************************************************************************************/
    private Object getEmptyValueByDisplayType(Schema.DisplayType fieldType) {
        switch on fieldType {
            when STRING, TEXTAREA, PHONE, EMAIL, URL, PICKLIST, MULTIPICKLIST, REFERENCE, ID, ENCRYPTEDSTRING {
                return '';
            }
            when INTEGER, DOUBLE, CURRENCY, PERCENT, LONG {
                return 0;
            }
            when BOOLEAN {
                return false;
            }
            when DATE {
                return null; // No good default for dates
            }
            when DATETIME {
                return null; // No good default for datetimes
            }
            when TIME {
                return null; // No good default for time
            }
            when BASE64 {
                return Blob.valueOf('');
            }
            when LOCATION {
                return null; // No good default for location
            }
            when ADDRESS {
                return null; // No good default for address
            }
            when else {
                return ''; // Default to empty string for other types
            }
        }
    }
    
    /**
     * Substitute null values in a list of SObjects
     * 
     * @param records List of SObjects to process
     * @param fieldPaths List of field paths to check for null values
     * @param throwExceptionOnInvalidPath Whether to throw exceptions for invalid paths
     * @return List<SObject> List of processed SObjects with null values substituted
     */
    public static List<SObject> substituteNullValues(List<SObject> records, List<String> fieldPaths, Boolean throwExceptionOnInvalidPath) {
        if (records == null || records.isEmpty() || fieldPaths == null || fieldPaths.isEmpty()) {
            return records;
        }
        
        List<SObject> results = new List<SObject>();
        
        for (SObject record : records) {
            if (record != null) {
                SObjectNullValueSubstituter substituter = new SObjectNullValueSubstituter(record, throwExceptionOnInvalidPath);
                results.add(substituter.substituteNullValues(fieldPaths));
            } else {
                results.add(null); // Preserve null records
            }
        }
        
        return results;
    }
    
    /**************************************************************************************
     * @description Substitute null values in a list of SObjects.
     * @param records List of SObjects to process.
     * @param fieldPaths List of field paths to check for null values.
     * @param throwExceptionOnInvalidPath Whether to throw exceptions for invalid paths.
     * @return List<SObject> List of processed SObjects with null values substituted.
     **************************************************************************************/
    public static List<SObject> substituteNullValues(List<SObject> records, List<String> fieldPaths) {
        return substituteNullValues(records, fieldPaths, true);
    }
    
    /**************************************************************************************
     * @description Substitute null values in a single SObject.
     * @param record SObject to process.
     * @param fieldPaths List of field paths to check for null values.
     * @param throwExceptionOnInvalidPath Whether to throw exceptions for invalid paths.
     * @return SObject Processed SObject with null values substituted.
     **************************************************************************************/
    public static SObject substituteNullValues(SObject record, List<String> fieldPaths, Boolean throwExceptionOnInvalidPath) {
        if (record == null || fieldPaths == null || fieldPaths.isEmpty()) {
            return record;
        }
        
        SObjectNullValueSubstituter substituter = new SObjectNullValueSubstituter(record, throwExceptionOnInvalidPath);
        return substituter.substituteNullValues(fieldPaths);
    }
    
    /**************************************************************************************
     * @description Substitute null values in a single SObject (throws exceptions on invalid paths).
     * @param record SObject to process.
     * @param fieldPaths List of field paths to check for null values.
     * @return SObject Processed SObject with null values substituted.
     **************************************************************************************/
    public static SObject substituteNullValues(SObject record, List<String> fieldPaths) {
        return substituteNullValues(record, fieldPaths, true);
    }
    
    /**
     * Custom exception class for SObjectNullValueSubstituter
     */
    public inherited sharing class SObjectNullValueSubstituterException extends Exception {}
    
}