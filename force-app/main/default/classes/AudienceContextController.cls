/*********************************************************************************************
 * @Name        AudienceContextController
 * @Group       Partner Portal
 * @description Controller for retrieving audience context and rules.
 **********************************************************************************************/
public without sharing class AudienceContextController {
    
    /******************************************************************************************
     * @description defaul Audience Metadata Provider
     ******************************************************************************************/
    private static AudienceMetadata.AudienceMetadataProvider metadataProvider = 
        new AudienceMetadata.RealAudienceMetadataProvider();

    
    /**************************************************************************************
    * @description  Sets AudienceMetadata.AudienceMetadataProvider instance to be used by controller.
    * @param   provider Instance of the AudienceMetadata.AudienceMetadataProvider implementation 
    *                    to be used by controller 
    **************************************************************************************/
    @TestVisible
    private static void setMetadataProvider(AudienceMetadata.AudienceMetadataProvider provider) {
        metadataProvider = provider;
    }

    /*********************************************************************************************
    * @description  Inner class to represent input context for audience evaluation.
    **********************************************************************************************/
    public without sharing class InputContext {
        @AuraEnabled
        public String recordId;
        @AuraEnabled
        public String objectApiName; 
        @AuraEnabled
        public Map<String, List<String>> sobjToFields;  
    }

    /*********************************************************************************************
    * @description  Inner class to represent location data.
    **********************************************************************************************/
    public without sharing class Location {
        @AuraEnabled
        public String country;
        @AuraEnabled
        public String state;
        @AuraEnabled
        public String city;
    }

    /*********************************************************************************************
    * @description Inner class to represent output context containing user and record data.
    **********************************************************************************************/
    public without sharing class OutputContext {
        @AuraEnabled
        public String profile;
        @AuraEnabled
        public String role;
        @AuraEnabled
        public List<String> permissions;
        @AuraEnabled
        public Location location;
        @AuraEnabled
        public Map<String,List<SObject>> dataBySObjectType;
    }

    /**************************************************************************************
    * @description  Retrieves the custom permissions assigned to a user.
    * @param   userId  The ID of the user.
    * @return          A set of custom permission names.
    **************************************************************************************/
    public static Set<String> getUserCustomPermissions(Id userId) {
        // Set to store custom permission names (prevents duplicates)
        Set<String> customPermissions = new Set<String>();
        
        // Get the user's profile and direct permission set assignments
        User currentUser = [SELECT ProfileId, 
                             (SELECT PermissionSetId FROM PermissionSetAssignments) 
                            FROM User 
                            WHERE Id = :userId 
                            WITH SYSTEM_MODE
                            LIMIT 1];
        
        // Collect all permission set IDs (including from profile)
        Set<Id> allPermSetIds = new Set<Id>();
        
        // Add profile (treated as a permission set)
        allPermSetIds.add(currentUser.ProfileId);
        
        // Add directly assigned permission sets
        Set<Id> directlyAssignedPermSetIds = new Set<Id>();
        for (PermissionSetAssignment psa : currentUser.PermissionSetAssignments) {
            directlyAssignedPermSetIds.add(psa.PermissionSetId);
            allPermSetIds.add(psa.PermissionSetId);
        }
        
        // Identify which directly assigned permission sets are groups
        Map<Id, PermissionSet> permSets = new Map<Id, PermissionSet>([
            SELECT Id, Type
            FROM PermissionSet
            WHERE Id IN :directlyAssignedPermSetIds
            WITH SYSTEM_MODE
        ]);
        
        Set<Id> permSetGroupIds = new Set<Id>();
        for (Id permSetId : directlyAssignedPermSetIds) {
            PermissionSet ps = permSets.get(permSetId);
            if (ps != null && ps.Type == 'Group') {
                permSetGroupIds.add(permSetId);
            }
        }
        
        // Get permission sets from groups
        if (!permSetGroupIds.isEmpty()) {
            for (PermissionSetGroupComponent psgc : [
                SELECT PermissionSetId 
                FROM PermissionSetGroupComponent 
                WHERE PermissionSetGroupId IN :permSetGroupIds
                WITH SYSTEM_MODE
            ]) {
                allPermSetIds.add(psgc.PermissionSetId);
            }
        }
        
        // Get custom permissions in one query with a map to avoid additional queries
        Map<Id, String> customPermissionsMap = new Map<Id, String>();
        for (CustomPermission cp : [SELECT Id, DeveloperName FROM CustomPermission WITH SYSTEM_MODE]) {
            customPermissionsMap.put(cp.Id, cp.DeveloperName);
        }
        
        // Get all SetupEntityAccess records for the permission sets and custom permissions
        for (SetupEntityAccess access : [
            SELECT SetupEntityId 
            FROM SetupEntityAccess 
            WHERE ParentId IN :allPermSetIds
            AND SetupEntityType = 'CustomPermission'
            WITH SYSTEM_MODE
        ]) {
            String permissionName = customPermissionsMap.get(access.SetupEntityId);
            if (permissionName != null) {
                customPermissions.add(permissionName);
            }
        }
        
        return customPermissions;
    }

    /**************************************************************************************
    * @description   Retrieves data based on the provided input context.
    * @param   inputContext The input context containing record ID and fields to retrieve.
    * @return              The output context containing user and record data.
    **************************************************************************************/
    private static OutputContext getDataForContext( InputContext inputContext ) {
        OutputContext ctx = new OutputContext();
        
        // Get the profile name
        Id currUserId = UserInfo.getUserId();
        List<Profile> profiles = [SELECT Id, Name FROM Profile WHERE Id in (SELECT ProfileId FROM User WHERE Id = :currUserId) WITH SYSTEM_MODE];
        ctx.profile = (profiles.size() > 0) ? profiles[ 0 ].Name : null;

        // Get the role name
        List<UserRole> roles = [SELECT Name FROM UserRole WHERE Id = :currUserId WITH SYSTEM_MODE];
        ctx.role = (roles.size() > 0) ? roles[0].Name : null;

        ctx.permissions = new List<String>( getUserCustomPermissions( UserInfo.getUserId() ) );

        ctx.dataBySObjectType = getDataBySObjectType( inputContext );

        getUserRelatedData(inputContext, ctx);

        return ctx;
    }

    /**************************************************************************************
    * @description   Retrieves context information based on a record ID.
    * @param   recordId The ID of the record for which to retrieve context.
    * @return          The output context containing user and record data.
    **************************************************************************************/
    private static OutputContext getContext( String recordId ) {
        InputContext inputContext = new InputContext();
        inputContext.recordId = recordId;
        
        List<LWR_Audience_Resource__mdt> resources = metadataProvider.getAudienceResources();

        inputContext.sobjToFields = new Map<String,List<String>>();

        for (LWR_Audience_Resource__mdt resource : resources) {
            String flds = resource.Fields_Array__c;
            List<String> fieldsArray = (List<String>)JSON.deserialize( flds, List<String>.class);
            inputContext.sobjToFields.put(resource.Sobject_API_Name__c, fieldsArray);
        }

        return getDataForContext(inputContext);
    }

    /**************************************************************************************
    * @description   Retrieves user-related data and adds it to the output context.
    * @param   inputCtxt The input context containing fields to retrieve for the User object.
    * @param   outpCtxt  The output context to which the user data will be added.
    **************************************************************************************/
    private static void getUserRelatedData( InputContext inputCtxt, OutputContext outpCtxt ) {
        Id currUserId = UserInfo.getUserId();
        String userSoql = 'SELECT Id, Country, State, City';
        List<String> userFields = inputCtxt.sobjToFields?.get('User');
        if (userFields != null) {
            for (String fld : userFields) {
                userSoql += ', ' + String.escapeSingleQuotes( fld );
            }
        }
        userSoql += ' FROM User WHERE Id = :currUserId'; // ContactId != null' ???;

        User currUser = (User)Database.query(userSoql, AccessLevel.SYSTEM_MODE)[ 0 ];
        currUser = (User)SObjectNullValueSubstituter.substituteNullValues( currUser, userFields);      

        // Get the location information
        outpCtxt.location = new Location();
        outpCtxt.location.country = currUser.Country;
        outpCtxt.location.state = currUser.State;
        outpCtxt.location.city = currUser.City;

        outpCtxt.dataBySObjectType.put( 'User', new List<User>{ currUser } );
    }

   /**************************************************************************************
    * @description  Retrieves SObject data based on the input context.
    * @param   ctxt The input context containing the record ID and fields to retrieve.
    * @return       A map of SObject types to lists of SObject records.
    **************************************************************************************/
    private static Map<String,List<SObject>> getDataBySObjectType( InputContext ctxt ) {
        Map<String,List<SObject>> dataBySObjectType = new Map<String,List<SObject>>();

        if ( String.isBlank(ctxt.recordId)) {
            return dataBySObjectType;
        }

        ID recordId = Id.valueOf(ctxt.recordId);
        String sobjName = recordId.getSObjectType().getDescribe().getName();
        List<String> fields = ctxt.sobjToFields.get(sobjName);
        String soqlStr = 'SELECT Id';
        for ( String fld : fields ) {
            soqlStr += ', ' + String.escapeSingleQuotes( fld );
        }
        soqlStr += ' FROM ' + sobjName + ' WHERE Id = :recordId';
        List<SObject> sobjs = Database.query( soqlStr, AccessLevel.SYSTEM_MODE );
        sobjs = SObjectNullValueSubstituter.substituteNullValues( sobjs, fields);      

        dataBySObjectType.put( sobjName, sobjs );

        return dataBySObjectType;
    }

    /*********************************************************************************************
    * @description  Inner class to represent an audience rule.
    **********************************************************************************************/
    public without sharing class AudienceRule {
        @AuraEnabled 
        public String audienceId;
        @AuraEnabled 
        public String audienceRule;
    }

    /**************************************************************************************
    * @description  Retrieves audience rules from custom metadata.
    * @return       A list of AudienceRule objects.
    **************************************************************************************/
    @AuraEnabled(cacheable=true)
    public static List<AudienceRule> getAudienceRules() {
        List<AudienceRule> rules = new List<AudienceRule>();
        List<LWR_Audience_Rule__mdt> audienceRules = metadataProvider.getAudienceRules();
        for ( LWR_Audience_Rule__mdt rule : audienceRules ) {
             AudienceRule audRule = new AudienceRule();
             audRule.audienceId = rule.Audience_Id__c;
             audRule.audienceRule = rule.Audience_Rule__c;
             rules.add( audRule );
        }
        return rules;
    }

    /*********************************************************************************************
    * @description  Inner class to represent audience rule priority.
    **********************************************************************************************/    
    public without sharing class AudienceRulePriority {
        @AuraEnabled 
        public String audienceId;
        @AuraEnabled 
        public Integer audienceRulePriority;
        @AuraEnabled
        public String objectApiName;
    }

    /**************************************************************************************
    * @description  Retrieves audience rule priorities for a specific target type (SObject).
    * @param   targetType The API name of the SObject for which to retrieve rule priorities.
    * @return       A list of AudienceRulePriority objects, ordered by priority.
    **************************************************************************************/    
    private static List<AudienceRulePriority> getAudienceRulePriority( String targetType ) {
        if ( String.isBlank(targetType) ) {
            return new List<AudienceRulePriority>();
        }

        List<AudienceRulePriority> rulesWithPriority = new List<AudienceRulePriority>();
    
        List<LWR_Audience_Page_Level_Rule_Priority__mdt> priorities = metadataProvider.getAudienceRulePriorities( targetType );
        for ( LWR_Audience_Page_Level_Rule_Priority__mdt priority : priorities ) {
             AudienceRulePriority ruleWithPriority = new AudienceRulePriority();
             ruleWithPriority.audienceId = priority.Audience_Rule_Id__c;
             ruleWithPriority.audienceRulePriority = Integer.valueOf( priority.Audience_Rule_Priority__c );
             ruleWithPriority.objectApiName = priority.SObject__c;
             rulesWithPriority.add( ruleWithPriority );
        }

        return rulesWithPriority;
    }

    /*********************************************************************************************
    * @description  Inner class to hold both the audience context and the audience rules.
    **********************************************************************************************/
    public without sharing class AudienceRulesAndContext {
        @AuraEnabled 
        public OutputContext context;
        @AuraEnabled 
        public List<AudienceRule> rules;
        @AuraEnabled
        public List<AudienceRulePriority> rulesWithPriority;
    }

    /**************************************************************************************
    * @description  Retrieves audience rules and priorities for a given priority key.
    * @param   audiencPriorityKey The key used to determine audience rule priority (e.g., SObject API name).
    * @return       An AudienceRulesAndContext object containing rules and their priorities.
    **************************************************************************************/
    private static AudienceRulesAndContext getContextAndRules( String audiencPriorityKey ) {
        AudienceRulesAndContext rulesAndCtxt = new AudienceRulesAndContext();
        rulesAndCtxt.rules = getAudienceRules();
        rulesAndCtxt.rulesWithPriority = getAudienceRulePriority( audiencPriorityKey );

        return rulesAndCtxt;
    }

    /**************************************************************************************
    * @description  Retrieves audience rules, priorities, and context based on an SObject API name.
    * @param   objectApiName The API name of the SObject to determine relevant audience rules.
    * @return                An AudienceRulesAndContext object containing the context and rules.
    **************************************************************************************/    
    @AuraEnabled(cacheable=true)
    public static AudienceRulesAndContext getContextAndRulesByObjectApiName( String objectApiName ) {
        AudienceRulesAndContext rulesAndCtxt = getContextAndRules( objectApiName );
        rulesAndCtxt.context = getContext( null );
        
        return rulesAndCtxt;
    }

    /**************************************************************************************
    * @description  Retrieves audience rules, priorities, and context based on a record ID.
    * @param   recordId The ID of the record to determine relevant audience rules and context.
    * @return           An AudienceRulesAndContext object containing the context and rules.
    * @throws  IllegalArgumentException If the recordId is blank or not a valid Id.
    **************************************************************************************/
    @AuraEnabled(cacheable=true)
    public static AudienceRulesAndContext getContextAndRulesByRecordId( String recordId) {
        if ( String.isBlank( recordId ) ) {
            throw new IllegalArgumentException( 'recordId is required' );
        }

        ID recId;
        try {
            recId = Id.valueOf( recordId );
        } 
        catch ( System.StringException ex ) {
            throw new IllegalArgumentException( 'recordId is not a valid Id' );
        }

        String sobj = recId.getSObjectType().getDescribe().getName();
        // Do we really need to have check below here? I suspect it is overcomplication if ID is valid 
        if ( String.isBlank( sobj ) ) { 
            throw new IllegalArgumentException( 'No object found for recordId: ' + recordId );
        }

        AudienceRulesAndContext rulesAndCtxt = getContextAndRules( sobj );
        rulesAndCtxt.context = getContext( recId );

        return rulesAndCtxt;
    }

    /**************************************************************************************
    * @description  Retrieves audience rules, priorities, and context based on a page name.
    * @param   pageName The name of the page to determine relevant audience rules.
    * @return            An AudienceRulesAndContext object containing the context and rules.
    **************************************************************************************/
    @AuraEnabled(cacheable=true)
    public static AudienceRulesAndContext getContextAndRulesByPageName( String pageName ) {
        AudienceRulesAndContext rulesAndCtxt = getContextAndRules( pageName );

        rulesAndCtxt.context = getContext( null );

        return rulesAndCtxt;
    }

}