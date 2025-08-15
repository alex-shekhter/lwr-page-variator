/*********************************************************************************************
 * @Name SObjectNullValueSubstituterTest
 * @Group Common Utility
 * @description Test class for the SObjectNullValueSubstituter utility class.
 * This test class covers various scenarios including substituting null values
 * in different field types, handling relationship fields, and exception handling.
 **********************************************************************************************/
@IsTest
private class SObjectNullValueSubstituterTest {

    /**************************************************************************************
     * @description Tests the constructor with a null record and the throwExceptionOnInvalidPath flag set to true.
     * @expectedException SObjectNullValueSubstituterException
     **************************************************************************************/
    @IsTest
    static void testConstructorWithNullRecordAndThrowException() {
        Test.startTest();
        try {
            new SObjectNullValueSubstituter(null, true);
            System.assert(false, 'Should have thrown SObjectNullValueSubstituterException');
        } catch (SObjectNullValueSubstituter.SObjectNullValueSubstituterException ex) {
            System.assert(ex.getMessage().contains('Record cannot be null'), 'Incorrect exception message');
        }
        Test.stopTest();
    }

    /**************************************************************************************
     * @description Tests the constructor with a null record and the throwExceptionOnInvalidPath flag set to false.
     * @expectedNoException
     **************************************************************************************/
    @IsTest
    static void testConstructorWithNullRecordAndNoThrowException() {
        Test.startTest();
        SObjectNullValueSubstituter substituter = new SObjectNullValueSubstituter(null, false);
        System.assert(substituter != null, 'Substituter should be initialized');
        Test.stopTest();
    }

    /**************************************************************************************
     * @description Tests substituting null values for simple fields of various data types.
     **************************************************************************************/
    @IsTest
    static void testSubstituteNullValuesSimpleFields() {
        TriggerHandler.config.setActive( Account.SObjectType, false );
        Account acc = new Account(
            Name = 'Test Account', 
            Description = null, 
            Phone = null, 
            NumberOfEmployees = null, 
            Rating = null, 
            BillingCity = null
        );
        insert acc;

        List<String> fieldsToProcess = new List<String>{'Description', 'Phone', 'NumberOfEmployees', 'Rating', 'BillingCity' };

        Test.startTest();
        SObjectNullValueSubstituter substituter = new SObjectNullValueSubstituter(acc);
        Account processedAcc = (Account) substituter.substituteNullValues(fieldsToProcess);
        Test.stopTest();

        System.assertEquals('', processedAcc.Description, 'Description should be an empty string');
        System.assertEquals('', processedAcc.Phone, 'Phone should be an empty string');
        System.assertEquals(0, processedAcc.NumberOfEmployees, 'NumberOfEmployees should be 0');
        System.assertEquals('', processedAcc.Rating, 'Rating (picklist) should be an empty string');
        System.assertEquals('', processedAcc.BillingCity, 'BillingCity should be an empty string');
    }

    /**************************************************************************************
     * @description Tests substituting null values for relationship fields.
     **************************************************************************************/
    @IsTest
    static void testSubstituteNullValuesRelationshipFields() {
        TriggerHandler.config.setActive( Account.SObjectType, false );

        Account parentAcc = new Account(Name = 'Parent Account');
        insert parentAcc;

        ContactTriggerHandler.tiggerDisabled = true;
        Contact con = new Contact(FirstName = 'Test Contact', LastName = 'Test Contact', AccountId = parentAcc.Id, MailingCity = null, OtherCountry = null, Email='bogustestemail@fictionalemail.com.invalid');
        insert con;

        List<String> fieldsToProcess = new List<String>{'Account.Description', 'MailingCity', 'OtherCountry'};

        Test.startTest();
        SObjectNullValueSubstituter substituter = new SObjectNullValueSubstituter(con);
        Contact processedCon = (Contact) substituter.substituteNullValues(fieldsToProcess);
        Test.stopTest();

        System.assertEquals('', processedCon.Account.Description, 'Related Account Description should be an empty string');
        System.assertEquals('', processedCon.MailingCity, 'MailingCity should be an empty string');
        System.assertEquals('', processedCon.OtherCountry, 'OtherCountry should be an empty string');
    }

    /**************************************************************************************
     * @description Tests substituting null values for a field that does not exist, expecting an exception.
     * @expectedException SObjectNullValueSubstituterException
     **************************************************************************************/
    @IsTest
    static void testSubstituteNullValuesInvalidField() {
        TriggerHandler.config.setActive( Account.SObjectType, false );

        Account acc = new Account(Name = 'Test Account');
        insert acc;

        List<String> fieldsToProcess = new List<String>{'NonExistingField'};
        SObjectNullValueSubstituter substituter = new SObjectNullValueSubstituter(acc);

        Test.startTest();
        try {
            substituter.substituteNullValues(fieldsToProcess);
            System.assert(false, 'Should have thrown SObjectNullValueSubstituterException');
        } catch (SObjectNullValueSubstituter.SObjectNullValueSubstituterException e) {
            System.assert(e.getMessage().contains('Error processing field path: NonExistingField'), 'Incorrect exception message');
        }
        Test.stopTest();
    }

    /**************************************************************************************
     * @description Tests substituting null values for an invalid relationship field, expecting an exception.
     * @expectedException SObjectNullValueSubstituterException
     **************************************************************************************/
    @IsTest
    static void testSubstituteNullValuesInvalidRelationshipField() {
        TriggerHandler.config.setActive( Account.SObjectType, false );

        Account acc = new Account(Name = 'Test Account');
        insert acc;

        List<String> fieldsToProcess = new List<String>{'Account.NonExistingRelationship.Name'};
        SObjectNullValueSubstituter substituter = new SObjectNullValueSubstituter(acc);

        Test.startTest();
        try {
            substituter.substituteNullValues(fieldsToProcess);
            System.assert(false, 'Should have thrown SObjectNullValueSubstituterException');
        } catch (SObjectNullValueSubstituter.SObjectNullValueSubstituterException e) {
            System.assert(e.getMessage().contains('Error processing field path: Account.NonExistingRelationship.Name'), 'Incorrect exception message');
        }
        Test.stopTest();
    }

    /**************************************************************************************
     * @description Tests the static substituteNullValues method for a list of SObjects.
     **************************************************************************************/
    @IsTest
    static void testStaticSubstituteNullValuesList() {
        TriggerHandler.config.setActive( Account.SObjectType, false );

        List<Account> accounts = new List<Account>{
                new Account(Name = 'Account 1', Description = null),
                new Account(Name = 'Account 2', Description = 'Not Null')
        };
        insert accounts;

        List<String> fieldsToProcess = new List<String>{'Description'};
        
        Test.startTest();
        List<SObject> processedAccounts = SObjectNullValueSubstituter.substituteNullValues(accounts, fieldsToProcess);
        Test.stopTest();

        System.assertEquals('', ((Account)processedAccounts[0]).Description, 'Account 1 Description should be empty');
        System.assertEquals('Not Null', ((Account)processedAccounts[1]).Description, 'Account 2 Description should remain');
    }

    /**************************************************************************************
     * @description Tests the static substituteNullValues method for a single SObject.
     **************************************************************************************/
    @IsTest
    static void testStaticSubstituteNullValuesSingle() {
        TriggerHandler.config.setActive( Account.SObjectType, false );

        Account acc = new Account(Name = 'Test Account', Description = null);
        insert acc;

        List<String> fieldsToProcess = new List<String>{'Description'};

        Test.startTest();
        Account processedAcc = (Account) SObjectNullValueSubstituter.substituteNullValues(acc, fieldsToProcess);
        Test.stopTest();

        System.assertEquals('', processedAcc.Description, 'Description should be empty');
    }

    /**************************************************************************************
     * @description Tests the behavior when an empty list of field paths is provided.
     **************************************************************************************/
    @IsTest
    static void testSubstituteNullValuesWithEmptyFieldList() {
        Account acc = new Account(Name = 'Test Account', Description = null);
        
        Test.startTest();
        SObjectNullValueSubstituter substituter = new SObjectNullValueSubstituter(acc);
        Account processedAcc = (Account) substituter.substituteNullValues(new List<String>());
        Test.stopTest();

        System.assertEquals(null, processedAcc.Description, 'Description should remain null');
    }

    /**************************************************************************************
     * @description Tests the behavior when a null list of field paths is provided.
     **************************************************************************************/
    @IsTest
    static void testSubstituteNullValuesWithNullFieldList() {
        Account acc = new Account(Name = 'Test Account', Description = null);

        Test.startTest();
        SObjectNullValueSubstituter substituter = new SObjectNullValueSubstituter(acc);
        Account processedAcc = (Account) substituter.substituteNullValues(null);
        Test.stopTest();

        System.assertEquals(null, processedAcc.Description, 'Description should remain null');
    }

    /**************************************************************************************
     * @description Tests the static substituteNullValues method with throwExceptionOnInvalidPath set to false
     * and an invalid field path. No exception should be thrown.
     **************************************************************************************/
    @IsTest
    static void testStaticSubstituteNullValuesNoExceptionInvalidField() {
        TriggerHandler.config.setActive( Account.SObjectType, false );
        Account acc = new Account(Name = 'Test Account', Description = null);
        insert acc;

        List<String> fieldsToProcess = new List<String>{'NonExistingField'};
        
        Test.startTest();
        Account processedAcc = (Account) SObjectNullValueSubstituter.substituteNullValues(acc, fieldsToProcess, false);
        Test.stopTest();

        System.assertEquals(null, processedAcc.Description, 'Description should remain null');
    }

    /**************************************************************************************
     * @description Tests the static substituteNullValues for a list with throwExceptionOnInvalidPath set to false
     * and an invalid field path. No exception should be thrown.
     **************************************************************************************/
    @IsTest
    static void testStaticSubstituteNullValuesListNoExceptionInvalidField() {
        TriggerHandler.config.setActive( Account.SObjectType, false );
        List<Account> accounts = new List<Account>{new Account(Name = 'Test Account', Description = null)};
        insert accounts;

        List<String> fieldsToProcess = new List<String>{'NonExistingField'};
        Test.startTest();
        List<SObject> processedAccounts = SObjectNullValueSubstituter.substituteNullValues(accounts, fieldsToProcess, false);
        Test.stopTest();

        System.assertEquals(null, ((Account)processedAccounts[0]).Description, 'Description should remain null');
    }

    /**************************************************************************************
     * @description Tests the static substituteNullValues method for a list of SObjects
     * with successful null value substitution.
     **************************************************************************************/
    @IsTest
    static void testStaticSubstituteNullValuesListSuccessfulSubstitution() {
        TriggerHandler.config.setActive( Account.SObjectType, false );

        List<Account> accounts = new List<Account>{
                new Account(Name = 'Account A', Description = null),
                null,
                new Account(Name = 'Account B', Description = 'Not Null')
        };
        insert accounts[0];
        insert accounts[2];

        List<String> fieldsToProcess = new List<String>{'Description'};

        Test.startTest();
        List<SObject> processedAccounts = SObjectNullValueSubstituter.substituteNullValues(accounts, fieldsToProcess, true);
        Test.stopTest();

        System.assertEquals(3, processedAccounts.size(), 'Should have the same number of records');
        System.assertEquals('', ((Account)processedAccounts[0]).Description, 'Account A Description should be empty');
        System.assertEquals(null, processedAccounts[1], 'Null record should remain null');
        System.assertEquals('Not Null', ((Account)processedAccounts[2]).Description, 'Account B Description should remain');
    }

    /**************************************************************************************
     * @description Tests the static substituteNullValues method for a list of SObjects
     * with throwExceptionOnInvalidPath = false, ignoring invalid fields.
     **************************************************************************************/
    @IsTest
    static void testStaticSubstituteNullValuesListIgnoreInvalidFields() {
        TriggerHandler.config.setActive( Account.SObjectType, false );

        List<Account> accounts = new List<Account>{
                new Account(Name = 'Account A', Description = null),
                new Account(Name = 'Account B', Description = 'Not Null')
        };
        insert accounts[0];
        insert accounts[1];

        Test.startTest();
        List<SObject> processedAccounts = SObjectNullValueSubstituter.substituteNullValues(accounts, new List<String>{'NonExistingField'}, false);
        Test.stopTest();

        System.assertEquals(2, processedAccounts.size(), 'Should have the same number of records');
        System.assertEquals(null, ((Account)processedAccounts[0]).get('Description'), 'Account A Description should remain null as invalid field is ignored');
        System.assertEquals('Not Null', ((Account)processedAccounts[1]).get('Description'), 'Account B Description should remain not modified');
    }

    /**************************************************************************************
     * @description Tests the static substituteNullValues method with a null records list.
     **************************************************************************************/
    @IsTest
    static void testStaticSubstituteNullValuesListNullRecordsList() {
        List<String> fieldsToProcess = new List<String>{'Description'};

        Test.startTest();
        List<SObject> nullRecordsList = SObjectNullValueSubstituter.substituteNullValues((List<SObject>)null, fieldsToProcess, true);
        Test.stopTest();

        System.assertEquals(null, nullRecordsList, 'Should return null for null records list');
    }

    /**************************************************************************************
     * @description Tests the static substituteNullValues method with an empty records list.
     **************************************************************************************/
    @IsTest
    static void testStaticSubstituteNullValuesListEmptyRecordsList() {
        List<String> fieldsToProcess = new List<String>{'Description'};

        Test.startTest();
        List<SObject> emptyRecordsList = SObjectNullValueSubstituter.substituteNullValues(new List<Account>(), fieldsToProcess, true);
        Test.stopTest();

        System.assertEquals(0, emptyRecordsList.size(), 'Should return an empty list');
    }

    /**************************************************************************************
     * @description Tests the static substituteNullValues method with a null field paths list.
     **************************************************************************************/
    @IsTest
    static void testStaticSubstituteNullValuesListNullFieldPaths() {
        TriggerHandler.config.setActive( Account.SObjectType, false );

        List<Account> accounts = new List<Account>{
                new Account(Name = 'Account A', Description = null)
        };
        insert accounts[0];

        Test.startTest();
        List<SObject> nullFieldPathsResult = SObjectNullValueSubstituter.substituteNullValues(accounts, null, true);
        Test.stopTest();

        System.assertEquals(1, nullFieldPathsResult.size(), 'Should return the original list');
        System.assertEquals(null, ((Account)nullFieldPathsResult[0]).Description, 'Account A Description should remain null');
    }

    /**************************************************************************************
     * @description Tests the static substituteNullValues method with an empty field paths list.
     **************************************************************************************/
    @IsTest
    static void testStaticSubstituteNullValuesListEmptyFieldPaths() {
        TriggerHandler.config.setActive( Account.SObjectType, false );
        List<Account> accounts = new List<Account>{
                new Account(Name = 'Account A', Description = null)
        };
        insert accounts[0];

        Test.startTest();
        List<SObject> emptyFieldPathsResult = SObjectNullValueSubstituter.substituteNullValues(accounts, new List<String>(), true);
        Test.stopTest();

        System.assertEquals(1, emptyFieldPathsResult.size(), 'Should return the original list');
        System.assertEquals(null, ((Account)emptyFieldPathsResult[0]).Description, 'Account A Description should remain null');
    }

}