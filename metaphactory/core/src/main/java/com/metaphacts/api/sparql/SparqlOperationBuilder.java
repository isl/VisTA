/*
 * Copyright (C) 2015-2017, metaphacts GmbH
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

package com.metaphacts.api.sparql;

import static com.google.common.base.Preconditions.checkNotNull;

import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.query.MalformedQueryException;
import org.eclipse.rdf4j.query.Operation;
import org.eclipse.rdf4j.query.QueryLanguage;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.google.common.collect.Maps;
import com.metaphacts.api.sparql.SparqlUtil.SparqlOperation;


/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 * @param <T>
 */
public class SparqlOperationBuilder<T extends Operation> {
    
    private static final Logger logger = LogManager.getLogger(SparqlOperationBuilder.class);
    
    private Class<? extends Operation>clazz;
    private String queryString;
    private Resource thisResource;
    private Resource userURI;
    private String baseURI;
    private Map<String,Value> bindings;
    private Boolean includeInferred = false;
    private int maxExecutionTime = 0;
    private Map<String, String> namespaces = Maps.newHashMap();
    
    private SparqlOperationBuilder(String queryString, Class<? extends Operation> clazz) {
        checkNotNull(queryString, "queryString must not be null.");
        checkNotNull(clazz, "clazz must not be null.");
        this.queryString = queryString;
        this.bindings = Maps.newHashMap();
        this.clazz = clazz;
    }

    public static <T extends Operation> SparqlOperationBuilder<T> create(String queryString, Class<? extends Operation> clazz) {
        return new SparqlOperationBuilder<T>(queryString,clazz);
    }
    
    public static SparqlOperationBuilder<Operation> create(String queryString) {
        return new SparqlOperationBuilder<Operation>(queryString,Operation.class);
    }
    
    
    /**
     * Sets the baseURI as it should be used by the query parser to resolve
     * relative URIs in the SPARQL query.
     * 
     * @param baseURI
     *            - Absolute baseURI string.
     * @return {@link SparqlOperationBuilder}
     */
    public SparqlOperationBuilder<T> setBaseURI(String baseURI) {
        this.baseURI = baseURI;
        return this;
    }
    
    /**
     * Query variables i.e. bindings to be replaced by the supplied {@link Value} parameter.
     * @param name
     * @param value
     * @return {@link SparqlOperationBuilder}
     */
    public SparqlOperationBuilder<T> setBinding(String name, Value value){
        this.bindings.put(name, value);
        return this;
    }
    
    /**
     * @see #setBinding(String, Value)
     */
    public SparqlOperationBuilder<T> setBindings(Map<String,Value> bindings){
        for (Map.Entry<String, Value> e : bindings.entrySet()) {
            this.bindings.put(e.getKey(), e.getValue());
        }
        return this;
    }
    
    /**
     * Instructs the repository to include implicit i.e. inferred statements for
     * query evaluation and in possible result sets.<br/>
     * Please note that this functionality depends heavily on the implementation
     * of the underlying repository.
     *
     * @param includeInferred
     *            true if inferred statements should be included for query
     *            evaluation and in result. <b>Default:</b> false
     * @return {@link SparqlOperationBuilder}
     */
    public SparqlOperationBuilder<T> setIncludeInferred(Boolean includeInferred){
        this.includeInferred = includeInferred;
        return this;
    }
    
    /**
     * Time in seconds until operation should be canceled.
     * @param maxExecutionTime time in seconds. <b>Default:</b> 30
     * @return
     */
    public SparqlOperationBuilder<T> setMaxExecutionTime(int maxExecutionTime){
        this.maxExecutionTime = maxExecutionTime;
        return this;
    }
    
    
    /**
     * Propagates namespaces to the repository connection the query to be evaluated on.
     * @param namespaces
     * @return
     */
    public SparqlOperationBuilder<T> setNamespaces(Map<String,String> namespaces){
        this.namespaces  = namespaces;
        return this;
    }

    /**
     * Parameterize magic binding variable <b>?__useruri__</b> within the query
     * with supplied {@link Resource}. Also replace legacy <b>??</b> parameter
     * with supplied {@link Resource}.
     * 
     * @param res
     * @return {@link SparqlOperationBuilder}
     */
    public SparqlOperationBuilder<T> resolveThis(Resource res){
        this.thisResource = res;
        return this;
    }
    
    /**
     * Parameterize magic binding variable <b>?__useruri__</b> within the query
     * with supplied {@link IRI}.
     * 
     * @param res
     * @return {@link SparqlOperationBuilder}
     */
    public SparqlOperationBuilder<T> resolveUser(IRI userURI){
        this.userURI = userURI;
        return this;
    }
    
    /**
     * Syntactic replacement of legacy parameters:
     * <ul>
     *  <li> <b>??</b> - for the current resource</li>
     * </ul>
     */
    private void replaceLegacyParameters() {
       if(this.thisResource!=null && this.queryString.contains("??")){
          // TODO enable this line, once we have aligned our default configuration etc. 
          // logger.warn("Query {} uses magic variable ?? which deprecated. Instead, please use ?__this__ in the future.", this.queryString);
          this.queryString= this.queryString.replaceAll("\\?\\?", "<"+this.thisResource.stringValue()+">");
       }
    }
    
    public T build(RepositoryConnection con) throws RepositoryException, MalformedQueryException, IllegalArgumentException{
        
        this.replaceLegacyParameters();
        SparqlOperation type = SparqlUtil.getOperationType(this.queryString);
        QueryLanguage ql = QueryLanguage.SPARQL;
        
        addNamespaces(con);
        
        Operation op = null;
        switch (type) {
            case UPDATE:
                op = con.prepareUpdate(ql, this.queryString, this.baseURI);
                break;
            case SELECT:
                op = con.prepareTupleQuery(ql, this.queryString, this.baseURI);
                break;
            case ASK:
                op = con.prepareBooleanQuery(ql, this.queryString, this.baseURI);
                break;
            case CONSTRUCT:
                op = con.prepareGraphQuery(ql, this.queryString, this.baseURI);
                break;
            case DESCRIBE:
                op = con.prepareGraphQuery(ql, this.queryString, this.baseURI);
                break;
            default:
                throw new MalformedQueryException("QueryString is neither a Tuple-, Boolean-, Graph- or Update Operation.");
        }
        op.setMaxExecutionTime(this.maxExecutionTime);
        op.setIncludeInferred(this.includeInferred);
        //bindings
        for(Map.Entry<String,Value>e : this.bindings.entrySet()){
            op.setBinding(e.getKey(), e.getValue());
        }
        // we need to check on the existence of the magic variable, before calling op.setBinding
        // this is required since setBinding injects the binding in all queries with wildcard projections
        if (this.queryString.contains(SparqlMagicVariables.USERURI) && this.userURI != null) {
            op.setBinding(SparqlMagicVariables.USERURI, userURI);
        }
        if (this.queryString.contains(SparqlMagicVariables.THIS) && this.thisResource != null) {
            op.setBinding(SparqlMagicVariables.THIS, thisResource);
        }
        return cast(op,this.clazz, type);
    }
    
    private void addNamespaces(RepositoryConnection con) {
        // TODO only HTTPRepositoryConnection allows to set namespaces directly on the connection, however,
        // the class is currently package private (which I believe is not by design)
//        if(con instanceof HTTPRepositoryConnection){
//            for(Map.Entry<String,String>e : this.namespaces.entrySet()){
//                con.setNamespace(e.getKey(),e.getValue());
//            }
//        }else{
            this.queryString=SparqlUtil.prependPrefixes(this.queryString, this.namespaces);
//        }
    }
    @SuppressWarnings("unchecked")
    private T cast(Operation o, Class<? extends Operation> clazz, SparqlOperation type) {
        try {
            return (T) clazz.cast(o);
        } catch(ClassCastException e) {
            String expected = StringUtils.join(StringUtils.splitByCharacterTypeCamelCase(clazz.getSimpleName())," ").toLowerCase();
            throw new IllegalArgumentException("Query is a SPARQL "+ type.toString() +" query. Expected a "+expected+ ".");
        }
    }
    
    
    /**
     * Magic variables to be replaced within SPARQL queries.
     */
    public static class SparqlMagicVariables {
        public static final String USERURI = "__useruri__";
        public static final String THIS = "__this__";
    }


}