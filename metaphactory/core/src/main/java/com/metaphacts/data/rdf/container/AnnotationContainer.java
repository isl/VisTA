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

package com.metaphacts.data.rdf.container;

import java.util.Optional;
import java.util.Set;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.google.common.base.Throwables;
import com.metaphacts.data.rdf.ModelUtils;
import com.metaphacts.data.rdf.PointedGraph;
import com.metaphacts.vocabulary.LDP;
import com.metaphacts.vocabulary.OA;

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 */
@LDPR(iri=AnnotationContainer.IRI_STRING)
public class AnnotationContainer extends AbstractLDPContainer {

    private static final Logger logger = LogManager.getLogger(AnnotationContainer.class);

    public static final String IRI_STRING = "http://www.metaphacts.com/ontologies/platform#annotationContainer";
    public static final IRI IRI = vf.createIRI(IRI_STRING);


    public AnnotationContainer(IRI iri, Repository repository) {
        super(iri, repository);
    }


    public void initialize() {
        if (!getReadConnection().hasOutgoingStatements(this.getResourceIRI())) {
            LinkedHashModel m = new LinkedHashModel();
            m.add(vf.createStatement(IRI, RDF.TYPE, LDP.Container));
            m.add(vf.createStatement(IRI, RDF.TYPE, LDP.Resource));
            m.add(vf.createStatement(IRI, RDFS.LABEL,vf.createLiteral("Annotations Container")));
            try {
                getRootContainer().add(new PointedGraph(IRI, m));
            } catch (RepositoryException e) {
                throw Throwables.propagate(e);
            }
        }
    }

    @Override
    public IRI add(PointedGraph pointedGraph) throws RepositoryException {
        return super.add(this.validateAndExtractStatements(pointedGraph));
    }

    @Override
    public void update(PointedGraph pointedGraph) throws RepositoryException {
        super.update(this.validateAndExtractStatements(pointedGraph));
    }

    private PointedGraph validateAndExtractStatements(PointedGraph pointedGraph){
        Model model = pointedGraph.getGraph();
        Set<Value> types = model.filter(pointedGraph.getPointer(), RDF.TYPE, null).objects();
        if(!types.contains(OA.ANNOTATION_CLASS))
            throw new IllegalArgumentException("Resource to be added to the Annotation Container must be at least of rdf:type oa:Annotation.");

        IRI bodyResource = Models.objectIRI(model.filter(pointedGraph.getPointer(), OA.HAS_BODY_PROPERTY, null)).orElseThrow(
                () -> new NullPointerException("Annotation must have a body.")
                );


        // replace body resource by IRI with meaningful identifier
        IRI newBodyResource = vf.createIRI(pointedGraph.getPointer().stringValue()+"/body");
        Model newModel = ModelUtils.replaceSubjectAndObjects(model, bodyResource, newBodyResource);

        Optional<Literal> annotationTextLit = Models.objectLiteral(newModel.filter(newBodyResource, OA.TEXT_PROPERTY, null));
        if (!annotationTextLit.isPresent()) {
            logger.warn("Annotation does not have a text.");
        }
       return new PointedGraph(pointedGraph.getPointer(), newModel);
    }

}
