/*********************************************************************************************
 * @Name AudienceContextControllerTest
 * @Group Partner Portal
 * @description Test class for the AudienceContextController.
 * This class tests the functionality of retrieving audience context and rules
 * using a mock implementation for Custom Metadata to ensure test isolation.
 **********************************************************************************************/
@isTest
private class AudienceContextControllerTest {

    /*********************************************************************************************
     * @description Comparator class used to sort LWR_Audience_Page_Level_Rule_Priority__mdt records
     * based on their Audience_Rule_Priority__c field.
     **********************************************************************************************/
    private class AudienceRulePriorityComparator implements Comparator<LWR_Audience_Page_Level_Rule_Priority__mdt> {

        /*****************************************************************************************
         * @description Compares two LWR_Audience_Page_Level_Rule_Priority__mdt records based on their priority.
         * @param   a The first record to compare.
         * @param   b The second record to compare.
         * @return  -1 if priority of 'a' is less than 'b', 1 if greater, and 0 if equal.
         *****************************************************************************************/
        public Integer compare(LWR_Audience_Page_Level_Rule_Priority__mdt a, LWR_Audience_Page_Level_Rule_Priority__mdt b) {
            Integer priorityA = Integer.valueOf(a.Audience_Rule_Priority__c);
            Integer priorityB = Integer.valueOf(b.Audience_Rule_Priority__c);
            if (priorityA < priorityB) {
                return -1;
            } else if (priorityA > priorityB) {
                return 1;
            } else {
                return 0;
            }        
        }
    }

    /*********************************************************************************************
     * @description Mock implementation of the AudienceMetadataProvider interface for testing purposes.
     * This allows us to control the Custom Metadata returned by the controller.
     **********************************************************************************************/
    public class MockAudienceMetadataProvider implements AudienceMetadata.AudienceMetadataProvider {
        private List<LWR_Audience_Rule__mdt> mockRules;
        private List<LWR_Audience_Page_Level_Rule_Priority__mdt> mockPriorities;
        private List<LWR_Audience_Resource__mdt> mockResources;
    
        /*****************************************************************************************
         * @description Constructor for the MockAudienceMetadataProvider, initializes empty lists.
         *****************************************************************************************/
        public MockAudienceMetadataProvider() {
            this.mockRules = new List<LWR_Audience_Rule__mdt>();
            this.mockPriorities = new List<LWR_Audience_Page_Level_Rule_Priority__mdt>();
            this.mockResources = new List<LWR_Audience_Resource__mdt>();
        }
    
        /*****************************************************************************************
         * @description Sets the list of mock audience rules to be returned.
         * @param   rules The list of LWR_Audience_Rule__mdt records.
         *****************************************************************************************/
        public void setAudienceRules(List<LWR_Audience_Rule__mdt> rules) {
            this.mockRules = rules;
        }
    
        /*****************************************************************************************
         * @description Sets the list of mock audience rule priorities to be returned.
         * @param   priorities The list of LWR_Audience_Page_Level_Rule_Priority__mdt records.
         *****************************************************************************************/
        public void setAudienceRulePriorities(List<LWR_Audience_Page_Level_Rule_Priority__mdt> priorities) {
            this.mockPriorities = priorities;
        }
    
        /*****************************************************************************************
         * @description Sets the list of mock audience resources to be returned.
         * @param   resources The list of LWR_Audience_Resource__mdt records.
         *****************************************************************************************/
        public void setAudienceResources(List<LWR_Audience_Resource__mdt> resources) {
            this.mockResources = resources;
        }
    
        /*****************************************************************************************
         * @description Returns the mock list of audience rules.
         * @return      The list of LWR_Audience_Rule__mdt records.
         *****************************************************************************************/
        public List<LWR_Audience_Rule__mdt> getAudienceRules() {
            return mockRules;
        }
    
        /*****************************************************************************************
         * @description Returns the mock list of audience rule priorities filtered by target type and sorted.
         * @param   targetType The API name of the SObject or page to filter priorities.
         * @return      The sorted list of LWR_Audience_Page_Level_Rule_Priority__mdt records.
         *****************************************************************************************/
        public List<LWR_Audience_Page_Level_Rule_Priority__mdt> getAudienceRulePriorities(String targetType) {
            List<LWR_Audience_Page_Level_Rule_Priority__mdt> filteredPriorities = new List<LWR_Audience_Page_Level_Rule_Priority__mdt>();
            for (LWR_Audience_Page_Level_Rule_Priority__mdt priority : mockPriorities) {
                if (priority.SObject__c == targetType) {
                    filteredPriorities.add(priority);
                }
            }
            filteredPriorities.sort(new AudienceRulePriorityComparator());
            return filteredPriorities;
        }
    
        /*****************************************************************************************
         * @description Returns the mock list of audience resources.
         * @return      The list of LWR_Audience_Resource__mdt records.
         *****************************************************************************************/
        public List<LWR_Audience_Resource__mdt> getAudienceResources() {
            return mockResources;
        }
    }    

    /*****************************************************************************************
     * @description Tests the getContextAndRulesByPageName method of the AudienceContextController.
     * It mocks the Custom Metadata and asserts the returned AudienceRulesAndContext.
     *****************************************************************************************/
    @isTest
    static void testGetContextAndRulesByPageName() {

        MockAudienceMetadataProvider mockProvider = new MockAudienceMetadataProvider();
        
        // Mock custom metadata records for testing
        List<LWR_Audience_Rule__mdt> audienceRules = new List<LWR_Audience_Rule__mdt>{
            new LWR_Audience_Rule__mdt(Audience_Id__c = 'pageRule1', Audience_Rule__c = 'some rule'),
            new LWR_Audience_Rule__mdt(Audience_Id__c = 'pageRule2', Audience_Rule__c = 'another rule')
        };
        mockProvider.setAudienceRules( audienceRules );

        List<LWR_Audience_Page_Level_Rule_Priority__mdt> priorities = new List<LWR_Audience_Page_Level_Rule_Priority__mdt>{
            new LWR_Audience_Page_Level_Rule_Priority__mdt(Audience_Rule_Id__c = 'pageRule1', Audience_Rule_Priority__c = 1, SObject__c = 'home'),
            new LWR_Audience_Page_Level_Rule_Priority__mdt(Audience_Rule_Id__c = 'pageRule2', Audience_Rule_Priority__c = 2, SObject__c = 'home')
        };
        mockProvider.setAudienceRulePriorities(priorities);

        AudienceContextController.setMetadataProvider(mockProvider);

        // Call the method to test
        Test.startTest();
        AudienceContextController.AudienceRulesAndContext result = AudienceContextController.getContextAndRulesByPageName('home');
        Test.stopTest();

        // Assertions
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertNotEquals(null, result.rules, 'Rules should not be null');
        System.assertNotEquals(null, result.rulesWithPriority, 'Rules with priority should not be null');
        System.assertEquals(2, result.rules.size(), 'Should have retrieved the correct number of rules');
        System.assertEquals(2, result.rulesWithPriority.size(), 'Should have retrieved the correct number of prioritized rules');
        System.assertEquals('pageRule1', result.rules[0].audienceId, 'Incorrect audience ID in rule');
        System.assertEquals(1, result.rulesWithPriority[0].audienceRulePriority, 'Incorrect rule priority');
        System.assertEquals('home', result.rulesWithPriority[0].objectApiName, 'Incorrect object API name in priority');
        System.assertNotEquals(null, result.context, 'Context should not be null');
    }

    /*****************************************************************************************
     * @description Tests the getContextAndRulesByRecordId method with a valid record ID.
     * It mocks the Custom Metadata and asserts the returned AudienceRulesAndContext and context data.
     *****************************************************************************************/
    @isTest
    static void testGetContextAndRulesByRecordIdValidId() {

        // Create a test account record
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;

        MockAudienceMetadataProvider mockProvider = new MockAudienceMetadataProvider();
        
        // Mock custom metadata for resources
        List<LWR_Audience_Resource__mdt> resources = new List<LWR_Audience_Resource__mdt>{
            new LWR_Audience_Resource__mdt(Sobject_API_Name__c = 'Account', Fields_Array__c = JSON.serialize(new List<String>{'Industry', 'Fax'})),
            new LWR_Audience_Resource__mdt(Sobject_API_Name__c = 'User', Fields_Array__c = JSON.serialize(new List<String>{'FirstName', 'LastName'}))
        };
        mockProvider.setAudienceResources(resources);

        // Mock custom metadata for rules
        List<LWR_Audience_Rule__mdt> audienceRules = new List<LWR_Audience_Rule__mdt>{
            new LWR_Audience_Rule__mdt(Audience_Id__c = 'recordRule1', Audience_Rule__c = 'account rule'),
            new LWR_Audience_Rule__mdt(Audience_Id__c = 'recordRule2', Audience_Rule__c = 'another account rule')
        };
        mockProvider.setAudienceRules(audienceRules);

        // Mock custom metadata for priorities
        List<LWR_Audience_Page_Level_Rule_Priority__mdt> priorities = new List<LWR_Audience_Page_Level_Rule_Priority__mdt>{
            new LWR_Audience_Page_Level_Rule_Priority__mdt(Audience_Rule_Id__c = 'recordRule1', Audience_Rule_Priority__c = 1, SObject__c = 'Account'),
            new LWR_Audience_Page_Level_Rule_Priority__mdt(Audience_Rule_Id__c = 'recordRule2', Audience_Rule_Priority__c = 2, SObject__c = 'Account')
        };
        mockProvider.setAudienceRulePriorities(priorities);

        AudienceContextController.setMetadataProvider(mockProvider);

        // Call the method to test
        Test.startTest();
        AudienceContextController.AudienceRulesAndContext result = AudienceContextController.getContextAndRulesByRecordId(testAccount.Id);
        Test.stopTest();

        // Assertions
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertNotEquals(null, result.rules, 'Rules should not be null');
        System.assertNotEquals(null, result.rulesWithPriority, 'Rules with priority should not be null');
        System.assertEquals(2, result.rules.size(), 'Should have retrieved the correct number of rules');
        System.assertEquals(2, result.rulesWithPriority.size(), 'Should have retrieved the correct number of prioritized rules');
        System.assertEquals('recordRule1', result.rules[0].audienceId, 'Incorrect audience ID in rule');
        System.assertEquals(1, result.rulesWithPriority[0].audienceRulePriority, 'Incorrect rule priority');
        System.assertEquals('Account', result.rulesWithPriority[0].objectApiName, 'Incorrect object API name in priority');
        System.assertNotEquals(null, result.context, 'Context should not be null');
        System.assertNotEquals(null, result.context.dataBySObjectType.get('Account'), 'Account data should be in context');
        System.assertEquals(1, result.context.dataBySObjectType.get('Account').size(), 'Should have retrieved one account record');
        System.assertEquals(testAccount.Id, result.context.dataBySObjectType.get('Account')[0].Id, 'Incorrect account ID in context');
    }

    /*****************************************************************************************
     * @description Tests the getContextAndRulesByRecordId method with an invalid record ID.
     * It asserts that an IllegalArgumentException is thrown.
     *****************************************************************************************/
    @isTest
    static void testGetContextAndRulesByRecordIdInvalidId() {
        // Call the method with an invalid record ID
        Test.startTest();
        String invalidId = 'invalidId';
        Boolean exceptionThrown = false;
        try {
            AudienceContextController.getContextAndRulesByRecordId(invalidId);
        } catch (IllegalArgumentException e) {
            exceptionThrown = true;
            System.assertEquals('recordId is not a valid Id', e.getMessage(), 'Incorrect exception message for invalid ID');
        }
        Test.stopTest();

        // Assertion
        System.assert(exceptionThrown, 'Should have thrown an IllegalArgumentException for invalid record ID');
    }

    /*****************************************************************************************
     * @description Tests the getContextAndRulesByRecordId method with a blank record ID.
     * It asserts that an IllegalArgumentException is thrown.
     *****************************************************************************************/
    @isTest
    static void testGetContextAndRulesByRecordIdBlankId() {
        // Call the method with a blank record ID
        Test.startTest();
        String blankId = '';
        Boolean exceptionThrown = false;
        try {
            AudienceContextController.getContextAndRulesByRecordId(blankId);
        } catch (IllegalArgumentException e) {
            exceptionThrown = true;
            System.assertEquals('recordId is required', e.getMessage(), 'Incorrect exception message for blank ID');
        }
        Test.stopTest();

        // Assertion
        System.assert(exceptionThrown, 'Should have thrown an IllegalArgumentException for blank record ID');
    }

    /*****************************************************************************************
     * @description Tests the getContextAndRulesByObjectApiName method.
     * It mocks the Custom Metadata and asserts the returned AudienceRulesAndContext.
     *****************************************************************************************/
    @isTest
    static void testGetContextAndRulesByObjectApiName() {

        // Set up mock provider
        MockAudienceMetadataProvider mockProvider = new MockAudienceMetadataProvider();

        // Mock custom metadata for resources
        List<LWR_Audience_Resource__mdt> resources = new List<LWR_Audience_Resource__mdt>{
            new LWR_Audience_Resource__mdt(Sobject_API_Name__c = 'Contact', Fields_Array__c = JSON.serialize(new List<String>{'FirstName', 'LastName'})),
            new LWR_Audience_Resource__mdt(Sobject_API_Name__c = 'User', Fields_Array__c = JSON.serialize(new List<String>{'Email'}))
        };
        mockProvider.setAudienceResources(resources);

        // Mock custom metadata for rules
        List<LWR_Audience_Rule__mdt> audienceRules = new List<LWR_Audience_Rule__mdt>{
            new LWR_Audience_Rule__mdt(Audience_Id__c = 'objectRule1', Audience_Rule__c = 'contact rule'),
            new LWR_Audience_Rule__mdt(Audience_Id__c = 'objectRule2', Audience_Rule__c = 'another contact rule')
        };
        mockProvider.setAudienceRules(audienceRules);

        // Mock custom metadata for priorities
        List<LWR_Audience_Page_Level_Rule_Priority__mdt> priorities = new List<LWR_Audience_Page_Level_Rule_Priority__mdt>{
            new LWR_Audience_Page_Level_Rule_Priority__mdt(Audience_Rule_Id__c = 'objectRule1', Audience_Rule_Priority__c = 1, SObject__c = 'Contact'),
            new LWR_Audience_Page_Level_Rule_Priority__mdt(Audience_Rule_Id__c = 'objectRule2', Audience_Rule_Priority__c = 2, SObject__c = 'Contact')
        };
        mockProvider.setAudienceRulePriorities(priorities);

        AudienceContextController.setMetadataProvider(mockProvider);

        // Call the method to test
        Test.startTest();
        AudienceContextController.AudienceRulesAndContext result = AudienceContextController.getContextAndRulesByObjectApiName('Contact');
        Test.stopTest();

        // Assertions
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertNotEquals(null, result.rules, 'Rules should not be null');
        System.assertNotEquals(null, result.rulesWithPriority, 'Rules with priority should not be null');
        System.assertEquals(2, result.rules.size(), 'Should have retrieved the correct number of rules');
        System.assertEquals(2, result.rulesWithPriority.size(), 'Should have retrieved the correct number of prioritized rules');
        System.assertEquals('objectRule1', result.rules[0].audienceId, 'Incorrect audience ID in rule');
        System.assertEquals(1, result.rulesWithPriority[0].audienceRulePriority, 'Incorrect rule priority');
        System.assertEquals('Contact', result.rulesWithPriority[0].objectApiName, 'Incorrect object API name in priority');
        System.assertNotEquals(null, result.context, 'Context should not be null');
    }
}